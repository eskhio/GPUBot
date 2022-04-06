/* eslint-disable consistent-return */
/* eslint-disable no-undef */
/* eslint-disable no-constructor-return */
/* eslint-disable class-methods-use-this */
const priceRegex = /(.*)\s?(?:\$|€)/;
const seedColor = require('seed-color');
const moment = require('moment');
const bavar = require('../discord/bavar');
const GPUError = require('../errors/GPUError');
const GPUEvents = require('../events/GPUEvents');

/**
 * A GPU
 * @class GPU
 */
class GPU extends GPUEvents {
  constructor(gpu) {
    super();
    this.raw = gpu;
    return this;
  }

  /**
   * @param {Bot} bot The GPU's bot
   * @description Parse a GPU + create the associated's bot
   * @returns {GPU} A parsed GPU
   */
  async init(bot) {
    this.bot = bot;
    return this.parse(bot)
      .catch((e) => {
        new GPUEvents().emit('gpuParseFail', e, this);
        throw e;
      })
      .then(async () => this)
      .catch(async (e) => {
        await bot.page.close();
        throw e;
      });
  }

  /**
   * @description Get complete GPU data: vendor & final URL, from an intermediary provider (eg. bavar)
   * @param {Bot} bot The GPU's bot
   */
  async getCompleteData(bot) {
    ({
      vendor: this.vendor,
      url: this.url,
    } = await bavar.process(bot)
      .catch((e) => {
        throw e;
      }));
    new GPUEvents().emit('gpuFetchedCompleteData', this);
    return true;
  }

  /**
   * @description Update a GPU's associated bot's config
   * @param {Bot} bot The GPU's bot
   * @returns {Bot} An updated bot for this GPU
   */
  async updateBot(bot) {
    return bot.updateGPU(this)
      && new GPUEvents().emit('gpuUpdatedBot', this);
  }

  /**
   * @description Parse a GPU from a raw Discord message
   * @param {Bot} bot The GPU's bot
   * @returns {GPU} A parsed GPU
   */
  async parse(bot) {
    return Promise.all([
      this.assertKnownGeneralStructure(),
      this.assertKnownBasicInformation(),
    ])
      .then(async () => {
        this.id = await this.parseID();
        this.price = await this.parsePrice();
        this.url = await this.parseURL(bot);
        this.date = await this.parseDropDate();
        this.vendor = await this.parseVendor(bot);
        this.color = seedColor(this.id).toHex();

        return this;
      }).catch((e) => {
        throw new GPUError(e?.details?.concat(` in ${JSON.stringify(this.raw)}`), e);
      })
      .then(async () => {
        await this.updateBot(bot);
        if (this.assertIsIncomplete()) {
          new GPUEvents().emit('gpuFetchingCompleteData', this);
          await this.getCompleteData(bot);
          return this.updateBot(bot, this);
        }
        new GPUEvents().emit('gpuParsed', this);
      });
  }

  /**
   * @description Parse a GPU's status
   * @param {Bot} bot The GPU's bot
   * @returns {Object} A GPU's spotted status' element
   */
  async parseStatus(bot) {
    // Wait for the first selector to pop within every possible statuses' selectors
    return Promise.race(
      Object.keys(bot.config.statuses).map(
        async (statusName) => {
          const possibleStatus = bot.config.statuses[statusName];
          const possibleStatusSelector = possibleStatus.selector;
          return bot.page.waitForSelector(possibleStatusSelector)
            .then(() => {
              possibleStatus.state = true;
              // Return an object with the status name as the key
              return {
                [statusName]: possibleStatus,
              };
            });
        },
      ),
    );
  }

  /**
   * @description Parse a GPU's add cart button element, if selector exists
   * @param {Bot} bot The GPU's bot
   * @returns {Object} An HTML element, if selector exists
   */
  async parseAddCartButtonElement(bot) {
    return bot.page.evaluate((addCartSel) => document.querySelector(addCartSel), bot.config.selectors.addCart).catch((e) => {
      throw e;
    });
  }

  /**
   * @description Parse a GPU's unavailable message element, if selector exists
   * @param {Bot} bot The GPU's bot
   * @returns {Object} An HTML element, if selector exists
   */
  async parseUnavailableMessageElement(bot) {
    return bot.page.evaluate((unSel) => document.querySelector(unSel), bot.config.selectors.unavailable).catch((e) => {
      throw e;
    });
  }

  /**
   * @description Parse a GPU's captcha element, if selector
   * @param {Bot} bot The GPU's bot
   * @returns {Object} An HTML element, if selector exists
   */
  async parseCaptchaElement(bot) {
    return bot.page.evaluate((capSel) => document.querySelector(capSel), bot.config.selectors.captcha).catch((e) => {
      throw e;
    });
  }

  /**
   * @description Parse a GPU's price, from a raw Discord message
   * @returns {String} A GPU's price
   */
  async parsePrice() {
    const priceField = this.raw.embeds[0].fields.find((field) => field.name === 'Prix');
    if (!priceField) throw new GPUError('No price field');
    if (priceRegex.test(priceField.value)) {
      return priceField.value.match(priceRegex)[1];
    }
    throw new GPUError('Price field\'s value format error');
  }

  /**
   * @description Parse a GPU's vendor, from a raw Discord message's embed's URL
   * @returns {String} A GPU's vendor
   */
  parseVendor(bot) {
    if (!bot.globalConfig.vendorRegex.test(this.url)) throw new Error(`Unknown vendor: ${this.url.match(/Acheter sur (.*)/)[1]}`);
    return this.url.match(bot.globalConfig.vendorRegex)[0].toLowerCase().replaceAll('\\s');
  }

  /**
   * @description Parse a GPU's URL, from a raw Discord message
   * @returns {String} A GPU's URL
   */
  async parseURL(bot) {
    if (bot.globalConfig.vendorRegex.test(this.raw.embeds[0].url)) {
      return this.raw.embeds[0].url;
    }
    throw new GPUError('Unknown URL');
  }

  /**
   * @description Parse a GPU's id, from a raw Discord message
   * @returns {String} A GPU's id
   */
  async parseID() {
    return this.raw.id;
  }

  /**
   * @description Parse a GPU's drop-date, from a raw Discord message
   * @returns {Moment} A GPU's drop-date
   */
  async parseDropDate() {
    this.date = new moment(this.raw.timestamp).format('HH:mm:ss');
  }

  /**
   * @description Parse the result text of the add in cart result text against known case
   * @returns {Promise} Wait for the success selector, meaning that the product has been added to cart
   */
  async parseAddCartResultText(config, page) {
    return page.waitForSelector(config.selectors.success, {
      timeout: 10000,
    })
      .then(async () => {
        const resultText = await page.evaluate((successElement) => {
          const resultElement = document.querySelector(successElement);
          if (resultElement) return resultElement.innerText.trim();
          return null;
        }, config.selectors.success);
        if (resultText) return resultText;
        throw new GPUError('Null result text content');
      })
      .catch(async (e) => {
        if (!await page.$(config.selectors.success)) {
          throw new GPUError('Result text selector not found');
        }
        throw e;
      });
  }

  /**
   * @description Asserts that a Discord message contains every mandatory piece of information: id, date, URL, price
   * @returns {Boolean}
   */
  async assertKnownBasicInformation() {
    if (!this.raw.id) {
      throw new GPUError('No ID');
    } else if (!this.raw.timestamp) {
      throw new GPUError('No date');
    } else if (!this.raw.embeds[0].url) {
      throw new GPUError('No URL');
    } else if (!this.raw.embeds[0].fields.find((field) => field.name === 'Prix')) {
      throw new GPUError('No price');
    }
    return true;
  }

  /**
   * @description Asserts that a Discord message is correctly formated: embeds, embeds' fields..
   * @returns {Boolean}
   */
  async assertKnownGeneralStructure() {
    if (!this.raw.embeds || !this.raw.embeds[0]) {
      throw new GPUError('No embeds');
    } else if (this.raw.embeds.length > 10) {
      throw new GPUError('Special embed');
    } else if (!this.raw.embeds[0].fields) {
      throw new GPUError('No fields in first embed');
    }
    return true;
  }

  /**
   * @description Asserts that a GPU doesn't have every final information needed (== from an intermediate provider)
   * @returns {Boolean}
   */
  assertIsIncomplete() {
    return /bavar/.test(this.vendor);
  }
}

module.exports = GPU;
