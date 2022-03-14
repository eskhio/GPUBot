/* eslint-disable no-constructor-return */
/* eslint-disable class-methods-use-this */
const priceRegex = /(.*)\s?(?:\$|€)/;
const seedColor = require('seed-color');
const moment = require('moment');
const bavar = require('../discord/bavar');
const GPUError = require('../errors/GPUError');
const GPUEvents = require('../events/GPUEvents');
const Bot = require('./provider');
const conf = require('../conf');
/**
 * A GPU
 * @class Backup
 */
class GPU extends GPUEvents {
  constructor(gpu) {
    super();
    this.raw = gpu;
    this.addListener('gpuFetchedCompleteData', () => { this.updateBot(); });
    this.on('gpuParsed', () => { this.updateBot(); });
    return this;
  }

  async init() {
    return this.parse()
      .catch((e) => { new GPUEvents().emit('gpuParseFail', e, this); throw e; })
      .then(async () => this.initBot().catch((e) => { throw e; }))
      .then(async () => {
        if (!this.bot) throw new GPUError('No bot');
        this.page = this.bot.page;
        if (this.assertIsIncomplete()) {
          new GPUEvents().emit('gpuFetchingCompleteData', this);
          await this.getCompleteData();
          new GPUEvents().emit('gpuFetchedCompleteData', this);
          await this.updateBot();
          new GPUEvents().emit('gpuUpdatedBot', this);
        }
        new GPUEvents().emit('gpuParsed', this);
        return this;
      })
      .catch((e) => { throw e; });
  }

  async updateBot() {
    return this.bot.update(this);
  }

  async initBot() {
    if (conf.providers[this.vendor]) {
      this.bot = await (new Bot(this))
        .init()
        .catch((e) => { throw new GPUError('GPU bot init failed', e); });
    } else throw new GPUError(`Unknown vendor: ${this.url}`);
  }

  /* Excluding every GPU without:
   *  - ID
   *  - Price
   */
  async parse() {
    return Promise.all([
      this.assertKnownGeneralStructure(),
      this.assertKnownBasicInformation(),
    ])
      .then(async () => {
        this.id = await this.parseID();
        this.price = await this.parsePrice();
        this.url = await this.parseURL();
        this.date = await this.parseDropDate();
        this.vendor = await this.parseVendor();
        this.color = seedColor(this.id).toHex();
        return this;
      }).catch((e) => {
        throw new GPUError(e.details.concat(` in ${JSON.stringify(this.raw)}`), e);
      });
  }

  async parsePrice() {
    const priceField = this.raw.embeds[0].fields.find((field) => field.name === 'Prix');
    if (!priceField) throw new GPUError('No price field');
    if (priceRegex.test(priceField.value)) {
      return priceField.value.match(priceRegex)[1];
    }
    throw new GPUError('Price field\'s value format error');
  }

  async parseVendor() {
    if (/ldlc/.test(this.url)) return ('ldlc');
    if (/ruedu/.test(this.url)) return ('rdc');
    if (/grob/.test(this.url)) return ('gb');
    if (/cdisco/.test(this.url)) return ('cd');
    if (/bavar/.test(this.url)) return ('bavar');
    if (/cybertek/.test(this.url)) return ('cybertek');
    throw new GPUError(`Unknown vendor: ${this.url}`);
  }

  async parseURL() {
    if (conf.vendorRegex.test(this.raw.embeds[0].url)) {
      return this.raw.embeds[0].url;
    }
    throw new GPUError('Unknown URL');
  }

  async getCompleteData() {
    ({ vendor: this.vendor, url: this.url } = await bavar.process(this).catch((e) => { throw e; }));
  }

  async parseID() {
    return this.raw.id;
  }

  async parseDropDate() {
    // eslint-disable-next-line new-cap
    this.date = new moment(this.raw.timestamp).format('HH:mm:ss');
  }

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

  assertIsIncomplete() {
    return /bavar/.test(this.vendor);
  }
}

module.exports = GPU;
