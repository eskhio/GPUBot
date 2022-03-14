/* eslint-disable class-methods-use-this */
/* eslint-disable no-multi-assign */
const {
  MultiSelect,
  Confirm,
  Input,
  Password,
} = require('enquirer');
require('dotenv').config();

const mongoose = require('mongoose');

class Config {
  constructor() {
    this.authorizations = {};
    this.conf = {
      providers: {},
      urls: {},
      browsers: {},
    };
    // Schemas
    this.vendorsSchema = new mongoose.Schema({
      name: String,
      selectors: {},
      regex: {},
      urls: {},
    });
    this.urlsSchema = new mongoose.Schema({
      service: {
        url: String,
        name: String,
      },
    });
    this.browsersSchema = new mongoose.Schema({
      system: String,
      model: String,
      path: String,
    });
    this.gpusSchema = new mongoose.Schema({
      model: {
        name: String,
        channelId: String,
      },
    });
    this.statusesSchema = new mongoose.Schema({
      name: String,
    });
    this.webSocketSchema = new mongoose.Schema({
      webSockets: {
        discord: Object,
      },
    });
  }

  static setAuthorization(provider, token) {
    this.conf.authorizations[provider] = token;
  }

  static setWebSocketToken(token) {
    this.conf.webSockets.discord.payload.d.token = token;
  }

  static modelPrompt(models) {
    return new MultiSelect({
      name: 'value',
      message: 'GPU models',
      limit: 7,
      choices: models,
    });
  }

  static async retryPrompt(error, fnToRetry) {
    new Confirm({
      name: 'question',
      message: `${error}, retry?`,
    }).run()
      .then(async (answer) => {
        if (answer) return fnToRetry();
        throw error;
      });
  }

  static promptMail() {
    return new Input({
      name: 'email',
      message: 'Discord email',
    });
  }

  static promptPass() {
    return new Password({
      name: 'pwd',
      message: 'Discord password',
    });
  }

  async initConfig() {
    await mongoose.connect('mongodb+srv://GPUBotUser:PZDkP5RGToywSRZt@gpubot.rbd4f.mongodb.net/bot', {
      useNewUrlParser: true,
    });
    const Vendors = mongoose.model('vendors', this.vendorsSchema);
    const Gpus = mongoose.model('gpus', this.gpusSchema);
    const Statuses = mongoose.model('statuses', this.statusesSchema);
    const WebSockets = mongoose.model('webSockets', this.webSocketSchema);
    const Urls = mongoose.model('urls', this.urlsSchema);
    const Browsers = mongoose.model('browsers', this.browsersSchema);
    const vendors = await Vendors.find({}, {
      _id: 0,
    });
    const urls = await Urls.find({}, {
      _id: 0,
    });
    const gpus = await Gpus.find({}, {
      _id: 0,
    });
    const statuses = await Statuses.find({}, {
      _id: 0,
    });
    const browsers = await Browsers.find({}, {
      _id: 0,
    });
    this.conf.browsers = browsers;
    this.conf.models = gpus.map((gpu) => gpu.model.name);
    this.conf.statuses = statuses.map((status) => status.name);
    vendors.forEach((vendor) => {
      if (!this.conf.providers[vendor.name]) {
        this.conf.providers[vendor.name] = {};
      }
      this.conf.providers[vendor.name].selectors = vendor.selectors;
      this.conf.providers[vendor.name].regex = vendor.regex;
      this.conf.providers[vendor.name].urls = vendor.urls;
      this.conf.providers[vendor.name].statuses = {};
      this.conf.statuses.filter((rawStatusName) => {
        if (!this.conf.providers[vendor.name].selectors[rawStatusName]) return null;
        if (!this.conf.providers[vendor.name].statuses[rawStatusName]) this.conf.providers[vendor.name].statuses[rawStatusName] = {};
        this.conf.providers[vendor.name].statuses[rawStatusName].selector = this.conf.providers[vendor.name].selectors[rawStatusName];
        this.conf.providers[vendor.name].statuses[rawStatusName].state = false;
        if (this.conf.providers[vendor.name].statuses[rawStatusName] == null) return null;
        return {
          [rawStatusName]: this.conf.statuses[rawStatusName],
        };
      });
    });
    this.conf.vendorRegex = new RegExp(Object.keys(this.conf.providers).join('|'), 'i');
    urls.forEach((url) => {
      if (!this.conf.urls[url.service.name]) this.conf.urls[url.service.name] = {};
      this.conf.urls[url.service.name].host = url.service.url;
      for (const gpu of gpus) {
        this.conf.urls[url.service.name][gpu.model.name] = gpu.model.channelId;
      }
    });
    this.conf.models = (await (Gpus.find())).map((gpu) => gpu.model.name);
    this.conf.webSockets = (await (WebSockets.findOne())).webSockets;
    return this.conf;
  }
}

module.exports = Config;
