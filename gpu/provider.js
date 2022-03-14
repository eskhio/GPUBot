/* eslint-disable no-undef */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const userAgent = require('user-agents');
const conf = require('../conf');
const ProviderError = require('../errors/ProviderError');
const GPUEvents = require('../events/GPUEvents');
const ProviderEvents = require('../events/ProviderEvents');
const fs = require('fs');
puppeteer.use(StealthPlugin());

/**
 * A GPUBot
 */
class Bot extends ProviderEvents {
  constructor(gpu) {
    super();
    this.gpu = gpu;
    this.on('gpuCaptcha', async () => this.page.close());
  }

  async init() {
    return this.setConfig(this.gpu)
      .then(async () => {
        await this.initBrowser();
        new ProviderEvents().emit('providerInit', this.gpu);
        return this;
      })
      .catch((e) => {
        new ProviderEvents().emit('providerInitFail', e, this.gpu);
        throw e;
      });
  }

  async update(gpu) {
    this.gpu = gpu;
    new ProviderEvents().emit('providerUpdateConfig', this.gpu);
    return this.init();
  }

  async setConfig(gpu) {
    this.gpu = gpu;
    this.name = gpu.vendor;
    this.conf = conf.providers[this.gpu.vendor];
    return this.checkConfig()
      .then(async () => new ProviderEvents().emit('providerConfigInit', this.gpu))
      .catch((e) => {
        throw e;
      });
  }

  async checkConfig() {
    await new Promise((resolve, reject) => {
      new ProviderEvents().emit('providerConfigCheck', {
        ...this.gpu,
        ...this.conf,
      });
      this.missingConfig = [];
      if (!this.conf || !this.conf.selectors) {
        reject(new ProviderError(`Empty config or selectors for ${this.name}`));
      }
      if (!this.conf.selectors.unavailable || !this.conf.selectors.addCart) {
        if (!this.conf.selectors.unavailable) this.missingConfig.push('unavailable message');
        if (!this.conf.selectors.addCart) this.missingConfig.push('add to cart');
        reject(new ProviderError(`Missing ${this.missingConfig.join('","')} config for ${this.name}`, this.gpu));
      }
      resolve();
    })
      .catch((e) => {
        throw e;
      });
  }

  async initBrowser() {
    try {
      if (!this.browser) {
        if (fs.existsSync(conf.browser.chrome.x64)) {
          this.browser = await puppeteer.launch({
            executablePath: conf.browser.chrome.x64,
            headless: false,
          });
        } else if (fs.existsSync(conf.browser.chrome.x86)) {
          this.browser = await puppeteer.launch({
            executablePath: conf.browser.chrome.x86,
            headless: false,
          });
        } else {
          throw new ProviderError('No Chrome detected');
        }
      }
      if (!this.page) {
        this.page = await this.browser.newPage();
        this.page.setUserAgent(userAgent.toString());
        new GPUEvents().emit('gpuPageOpened', this);
      }
    } catch (e) {
      throw new ProviderError('Browser init failed', e);
    }
  }

  /**
   * Main routine: go to GPU URL and try to add it to cart
   */
  async process() {
    this.openStorePage()
      .then(() => {
        new GPUEvents().emit('gpuLoaded', this.gpu);
        return this.checkStatus().catch(() => {});
      })
      .catch((e) => {
        throw e;
      });
  }

  /**
    Open the GPU's store page and wait for either RGPD/outage message/add to cart button
   */
  async openStorePage() {
    await this.gpu.page.setUserAgent(userAgent.toString());
    return this.gpu.page.goto(this.gpu.url, {
      timeout: 10000,
    })
      .catch((e) => {
        throw new ProviderError('Error loading GPU', e);
      });
  }

  async checkStatus() {
    new GPUEvents().emit('gpuCheckingStatus', this.gpu);
    return Promise.race([
      this.gpu.page.waitForSelector(this.conf.selectors.addCart),
      this.gpu.page.waitForSelector(this.conf.selectors.unavailable),
      this.gpu.page.waitForSelector(this.conf.selectors.captcha),
    ])
      .catch(async (e) => {
        throw new ProviderError('No add cart nor outage message nor catpcha', e);
      })
      .then(async () => this.handleStatus()
        .catch((e) => {
          throw e;
        }));
  }

  async handleStatus() {
    const addCartButton = await this.gpu.page.evaluate((addCartSel) => document.querySelector(addCartSel), this.conf.selectors.addCart)
      .catch(() => {});
    const unavailableMessage = await this.gpu.page.evaluate((unSel) => document.querySelector(unSel), this.conf.selectors.unavailable)
      .catch(() => {});
    const captcha = await this.gpu.page.evaluate((capSel) => document.querySelector(capSel), this.conf.selectors.captcha)
      .catch(() => {});
    if (addCartButton) {
      this.gpu.status = 'available';
      new GPUEvents().emit('gpuAvailable', this.gpu);
      await this.addCart();
      return this;
    }
    if (unavailableMessage) {
      this.gpu.status = 'outage';
      new GPUEvents().emit('gpuOutage', this.gpu);
      await this.page.close();
      throw new ProviderError('Outage');
    } else if (captcha) {
      this.gpu.status = 'captcha';
      new GPUEvents().emit('gpuCaptcha', this.gpu);
      throw new ProviderError('Catpcha');
    }
    throw new ProviderError('Unknown status error');
  }

  /**
   * Add a GPU to cart and handle the result
   */
  async addCart() {
    new GPUEvents().emit('gpuAdding', this.gpu);
    return Promise.race([
      this.clickAndNavigate(this.conf.selectors.addCart),
      this.handleAddCartResult(),
    ])
      .catch(async (e) => {
        new GPUEvents().emit('gpuAddCartFail', e, this.gpu);
        await this.brower.close();
        throw e;
      })
      .then(() => {
        new GPUEvents().emit('gpuAdded', this.gpu);
      });
  }

  /**
   * Get the status of the cart, after trying to add in the GPU
   */
  async handleAddCartResult() {
    // Waiting for the result element to be displayed + tested against known OK/NOK status
    // 1. Get the displayed result text, if available
    return this.parseAddCartResultText()
      .then((resultText) => {
        // 2. If the message looks like we succeeded, yay!
        if (this.testAddCartResultText(resultText)) return resultText;
        // 2.1 Else, bouh!
        throw new ProviderError(`Incorrect result text: '${resultText}'`);
      })
      .catch((e) => {
        throw e;
      });
  }

  /**
   * Parse the result text of the add in cart against known case
   */
  async parseAddCartResultText() {
    return this.gpu.page.waitForSelector(this.conf.selectors.success, {
      timeout: 10000,
    })
      .then(async () => {
        const resultText = await this.gpu.page.evaluate((successElement) => {
          const resultElement = document.querySelector(successElement);
          if (resultElement) return resultElement.innerText.trim();
          return null;
        }, this.conf.selectors.success);
        if (resultText) return resultText;
        throw new ProviderError('Null result text content');
      })
      .catch(async (e) => {
        if (!await this.gpu.page.$(this.conf.selectors.success)) {
          throw new ProviderError('Result text selector not found');
        }
        throw e;
      });
  }

  /**
   * Test the result text of the add in cart against known case
   * @param {String} resultText
   */
  testAddCartResultText(resultText) {
    return new RegExp(this.conf.regex.addCart.success, 'gi')
      .test(resultText);
  }

  /**
   * Handle any known RGPD message, if necessary
   */
  async handleRGPD() {
    return this.gpu.page.waitForSelector(this.conf.selectors.rgpdBypass, {
      timeout: 10000,
    })
      .then(async () => {
        new GPUEvents().emit('gpuBypassingRGPD', this.gpu.page.url());
        await this.clickAndNavigate(this.conf.selectors.rgpdBypass);
      });
  }

  /**
   * Click within a webpage + wait any navigation
   * @param {any} selector
   */
  async clickAndNavigate(selector) {
    // eslint-disable-next-line no-undef
    return this.gpu.page.waitForFunction((sel) => typeof ($(sel).click) === 'function', {}, selector)
      .then(async () => Promise.all([
        // 1. Click wherever
        // eslint-disable-next-line no-undef
        this.gpu.page.evaluate((eleSelector) => document.querySelector(eleSelector).click(), selector),
        // 2. Wait for sth to happen
        this.gpu.page.waitForNavigation({
          waitUntil: ['domcontentloaded', 'networkidle0'],
        }),
      ]));
  }
}

module.exports = Bot;
