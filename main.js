#!/usr/bin/env node

/* eslint-disable no-undef */
const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const GPU = require('./gpu/gpu');
const Config = require('./Config');
const Discord = require('./discord/discord');
const Bot = require('./gpu/bot');
const {
  EventEmitter
} = require('stream');
const chalk = require('chalk');

puppeteer.use(StealthPlugin());

class Main extends EventEmitter {

  constructor(configInstance) {
    super();
    this.configInstance = configInstance;
    this.config = configInstance.conf;
    this.mainSpinner = Config.mainSpinner('Waiting for new GPUs');
    this.discordInstance = new Discord(this.config);
    this.discordInstance.on('gpuDiscordFetched', async (data) => {
      return this.handleGPU(data, this.config)
      .then(() => {
        setTimeout(async () => this.mainSpinner.start(), 4000);
      });
    });
    return this;
  }
  /**
   * @description Init selected models, Discord and browser instance
   * @returns {Promise} Wait for a models, disord and browser to be init
   */
  async init() {
    this.mainSpinner.stop();
    return this.initSelectedModels()
      .then(() => {
        return this.initDiscord(this.selectedModels)
          .catch((e) => {
            throw e;
          })
      })
      .then(() => this.initBrowser().catch((e) => { 
        this.mainSpinner.fail(chalk.red(`Check your chrome installation. Checked into:\n`));
        this.config.browsers.map((b) => console.log(chalk.red(`- ${b.path}`)));
          throw e; 
      }));
  }

  /**
   * @description Main routine: init a bot and try to process a GPU
   * @param {Object} rawGPU The raw GPU from Discord
   * @param {Object} config The global config
   * @returns {Promise} GPU has been processed
   */
  async handleGPU(rawGPU, config) {
    try {
      this.mainSpinner.info("New GPU");
      const bot = await (new Bot(config))
        .init(new GPU(rawGPU), this.browserInstance);
      await bot.process(config)
        .catch((e) => { })
    } catch (e) { }
  }
  /**
   * @description Init a browser
   */
  async initBrowser() {
    try {
      for (const browser of this.config.browsers) {
        if (fs.existsSync(browser.path)) {
          this.browserInstance = await puppeteer.launch({
            executablePath: browser.path,
            headless: false,
          });
          break;
        }
      }
      if (!this.browserInstance) {
        throw new Error('No Chrome detected');
      }
    } catch(e) { throw e; }
  }
  /**
   * @description Init the Discord web socket
   * @param {Array} selectedModels The selected GPU models
   * @returns {Promise} Wait for the web socket to be init
   */
  async initDiscord(selectedModels) {
    return this.discordInstance.init(selectedModels)
      .catch((e) => {
        throw e;
      })
      .then(() =>  this.mainSpinner.start())
  }
  /**
   * @description Init the selected GPUs models
   */
  async initSelectedModels() {
    this.selectedModels = await Config.modelPrompt(this.config.models);
  }
}
(async () => {
  new Main(await (new Config()).init())
    .init()
    .catch((e) => {
      process.exit(-1);
    })
})();