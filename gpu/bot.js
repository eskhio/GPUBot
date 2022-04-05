/* eslint-disable no-undef */
const userAgent = require('user-agents');

const BotError = require('../errors/BotError');
const GPUEvents = require('../events/GPUEvents');
const BotEvents = require('../events/BotEvents');

/**
 * A bot
 * @class Bot
 */
class Bot extends BotEvents {
  constructor(globalConfig) {
    super();
    this.globalConfig = globalConfig;
    this.on('gpuCaptcha', async () => this.page.close());
  }

  /**
   * @description Init the bot's assets
   * @param {GPU} gpu The bot's handled GPU
   * @param {Object} browser The bot's browser
   * @returns {Bot} The bot
   */
  async init(gpu, browser) {
    await this.initBrowser(browser);
    await this.initPage();
    await this.initGPU(gpu);
    return this;
  }

  /**
   * @description Init the bot's handled GPU
   * @param {GPU} gpu The GPU to handle
   * @returns {Bot} The bot
   */
  async initGPU(gpu) {
    this.gpu = gpu;
    await gpu.init(this)
      .catch((e) => {
        throw e;
      });
    this.name = this.gpu.vendor;
  }

  /**
   * @description Init a page for the bot's browser
   * @param {Object} browser The bot's browser
   * @returns {Bot} The bot
   */
  initBrowser(browser) {
    this.browser = browser;
    return this;
  }

  /**
   * @description Init a page for the bot's browser
   * @returns {Bot} The bot
   */
  async initPage() {
    if (!this.page) {
      this.page = await this.browser.newPage();
      this.page.setUserAgent(userAgent.toString());
    }
    return this;
  }

  /**
   * @description Main routine: go to the GPU's URL and try to add it to cart
   * @returns {Promise} Wait for a GPU to be fully loaded+tagged+added to cart (or not)
   */
  async process() {
    return this.openStorePage()
      .catch((e) => {
        new GPUEvents().emit('gpuLoadFail', this.gpu, e);
        if (this.browser) this.page.close();
        throw e;
      })
      .then(async () => {
        new GPUEvents().emit('gpuLoaded', this.gpu);
        return this.checkStatus()
          .catch(async (e) => {
            await this.page.close();
            throw e;
          })
          .then(async (rawStatus) => this.handleStatus(rawStatus)
            .catch(async (e) => {
              new GPUEvents().emit('gpuHandleStatusFail', e, this.gpu);
              await this.page.close();
              throw e;
            }))
          .then(() => this.addCart().catch((e) => {
            throw e;
          }));
      });
  }

  /**
   * @description Update a bot's GPU
   * @param {GPU} gpu A GPU
   * @returns {Promise} Bot's config has been updated
   */
  async updateGPU(gpu) {
    this.gpu = gpu;
    return new BotEvents().emit('botUpdateConfig', gpu)
      && this.updateGPUConfig(this.globalConfig.providers[gpu.vendor]);
  }

  async updateGPUConfig(gpuConfig) {
    this.config = gpuConfig;
    return this.checkConfig()
      .then(async () => new BotEvents().emit('botConfigInit', this) && this)
      .catch((e) => {
        throw e;
      });
  }

  /**
   * @description Check that a bot's config is correctly formated
   * @returns {Promise} Config structure has been verified
   */
  async checkConfig() {
    await new Promise((resolve, reject) => {
      new BotEvents().emit('botConfigCheck', {
        ...this.gpu,
        ...this.config,
      });
      this.missingConfig = [];
      if (!this.config) reject(new BotError(`Empty config for ${this.name}`));
      if (!this.config.selectors) reject(new BotError(`Empty selectors for ${this.name}`));

      if (!this.config.selectors.unavailable || !this.config.selectors.addCart) {
        if (!this.config.selectors.unavailable) this.missingConfig.push('unavailable message');
        if (!this.config.selectors.addCart) this.missingConfig.push('add to cart');
        reject(new BotError(`Missing ${this.missingConfig.join('","')} config for ${this.name}`, this.gpu));
      }
      resolve();
    })
      .catch((e) => {
        throw e;
      });
  }

  /**
   * @description Open the GPU's store page and wait for either RGPD/outage message/add to cart button
   * @returns {Promise} Wait for a GPU's page to be opened
   */
  async openStorePage() {
    await this.page.setUserAgent(userAgent.toString());
    return this.page.goto(this.gpu.url, {
      timeout: 10000,
    })
      .catch((e) => {
        throw new BotError('Error loading GPU', e);
      });
  }

  /**
   * @description Check the status of a GPU
   * @returns {Promise} GPU's status parsed
   */
  async checkStatus() {
    new GPUEvents().emit('gpuCheckingStatus', this.gpu);
    return Promise.race([
      this.page.waitForSelector(this.config.selectors.addCart),
      this.page.waitForSelector(this.config.selectors.unavailable),
      this.page.waitForSelector(this.config.selectors.captcha),
    ])
      .catch(async (e) => {
        new GPUEvents().emit('gpuCheckStatusFail', e, this);
        throw e;
      })
      .then(async () => this.gpu.parseStatus(this)
        .catch((e) => {
          new GPUEvents().emit('gpuParseStatusFail', e, this.gpu);
          throw e;
        }));
  }

  /**
   * @description Try to add a GPU to cart
   * @returns {Promise} Wait for the product to be added to cart (or fail)
   */
  async addCart() {
    new GPUEvents().emit('gpuAdding', this.gpu);
    return Promise.race([
      this.clickAndNavigate(this.config.selectors.addCart),
      this.handleAddCartResult(),
    ])
      .catch(async (e) => {
        new GPUEvents().emit('gpuAddCartFail', e, this.gpu);
        await this.page.close();
        throw e;
      })
      .then(() => {
        new GPUEvents().emit('gpuAdded', this.gpu);
      });
  }

  /**
   * @description Handle the status of a GPU
   * @param {Object} status The raw GPU's status
   * @returns {Bot} The bot, if GPU is in cart
   */
  async handleStatus(status) {
    if (status?.addCart?.state) {
      this.gpu.status = 'addCart';
      new GPUEvents().emit('gpuAvailable', this.gpu);
      return this;
    }
    if (status?.unavailable?.state) {
      this.gpu.status = 'outage';
      new GPUEvents().emit('gpuOutage', this.gpu);
      throw new BotError('Outage');
    } else if (status?.captcha?.state) {
      this.gpu.status = 'captcha';
      new GPUEvents().emit('gpuCaptcha', this.gpu);
      throw new BotError('Catpcha');
    }
    throw new BotError('Unknown handle status error');
  }

  /**
   * @description Handle the status of the cart, after trying to add in the GPU
   * @returns {Promise} Wait for the result element to be displayed + tested against known OK/NOK status
   */
  async handleAddCartResult() {
    // 1. Get the displayed result text, if available
    return this.gpu.parseAddCartResultText(this.config, this.page)
      .then((resultText) => {
        // 2. If the message looks like we succeeded, yay!
        if (this.testAddCartResultText(resultText)) return resultText;
        // 2.1 Else, bouh!
        new GPUEvents().emit('gpuTestAddCartResultText', this.gpu);
        throw new BotError(`Incorrect result text: '${resultText}'`);
      })
      .catch((e) => {
        throw e;
      });
  }

  /**
   * @description Test the result text following the add in cart against known cases
   * @param {String} resultText The text displayed after the cart adding
   * @returns {Boolean} Is it a success
   */
  testAddCartResultText(resultText) {
    return new RegExp(this.config.regex.addCart.success, 'gi')
      .test(resultText);
  }

  /**
   * @description Handle any known RGPD message
   * @returns {Promise} Wait for the RPGD's message to be skipped
   */
  async handleRGPD() {
    return this.page.waitForSelector(this.config.selectors.rgpdBypass, {
      timeout: 10000,
    })
      .then(async () => {
        new GPUEvents().emit('gpuBypassingRGPD', this.page.url());
        await this.clickAndNavigate(this.config.selectors.rgpdBypass);
      });
  }

  /**
   * @description Click within a webpage + wait any navigation
   * @param {String} selector
   * @returns {Promise} Selector has been clicked on and/or a navigation occured
   */
  async clickAndNavigate(selector) {
    // eslint-disable-next-line no-undef
    return this.page.waitForFunction((sel) => typeof ($(sel).click) === 'function', {}, selector)
      .then(async () => Promise.all([
        // 1. Click wherever
        // eslint-disable-next-line no-undef
        this.page.evaluate((eleSelector) => document.querySelector(eleSelector).click(), selector),
        // 2. Wait for sth to happen
        this.page.waitForNavigation({
          waitUntil: ['domcontentloaded', 'networkidle0'],
        }),
      ]));
  }
}

module.exports = Bot;
