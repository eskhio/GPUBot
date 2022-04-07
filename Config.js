/* eslint-disable class-methods-use-this */
/* eslint-disable no-multi-assign */
const {
  MultiSelect,
  Confirm,
  Input,
  Password,
  Select
} = require('enquirer');
require('dotenv').config();
const ora = require('ora');
const mongoose = require('mongoose');
const chalk = require('chalk');

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
    this.Vendors = mongoose.model('vendors', this.vendorsSchema);
    this.Gpus = mongoose.model('gpus', this.gpusSchema);
    this.Statuses = mongoose.model('statuses', this.statusesSchema);
    this.WebSockets = mongoose.model('webSockets', this.webSocketSchema);
    this.Urls = mongoose.model('urls', this.urlsSchema);
    this.Browsers = mongoose.model('browsers', this.browsersSchema);

    return this;
  }

  static async modelPrompt(models) {
    return new MultiSelect({
      name: 'value',
      prefix: "-",
      separator: "-",
      message: 'Wanted models',
      choices: models,
    }).run()
      .then((selectedModels) => {
        if(selectedModels.length === 0) throw new Error("No choice");
        return selectedModels;
    })
  }

  static async retryPrompt(error, fnToRetry) {
    return new Confirm({
      name: 'question',
      message: `${chalk.red(error)}, retry?`,
    }).run()
      .then(async (answer) => {
        console.log("\n");
        if (answer) {
          return fnToRetry()
        }
        throw new Error("Aborting")
      }).catch((e) => { throw e; });
  }

  static discordSpinner(text){
    return ora({
      interval: 60,
      text: text || 'Discord init',
      discardStdin: true,
      spinner: 'dots4',
    });
  }
  static mainSpinner(text){
    return ora({
      interval: 60,
      prefixText: '\n',
      suffixText: '\n\n',
      text: text,
      discardStdin: false,
      spinner: 'dots4',
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

  async init() {
    await mongoose.connect('mongodb+srv://GPUBotUser:PZDkP5RGToywSRZt@gpubot.rbd4f.mongodb.net/bot', {
      useNewUrlParser: true,
    });

    const vendors = await this.Vendors.find({}, {
      _id: 0,
    });
    const urls = await this.Urls.find({}, {
      _id: 0,
    });
    const gpus = await this.Gpus.find({}, {
      _id: 0,
    });
    const statuses = await this.Statuses.find({}, {
      _id: 0,
    });
    const browsers = await this.Browsers.find({}, {
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
    this.conf.models = (await (this.Gpus.find())).map((gpu) => gpu.model.name);
    this.conf.webSockets = (await (this.WebSockets.findOne())).webSockets;
    return this;
  }
}

module.exports = Config;
