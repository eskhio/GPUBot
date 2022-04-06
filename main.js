#!/usr/bin/env node

/* eslint-disable no-undef */
const ora = require('ora');
const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const GPU = require('./gpu/gpu');
const Config = require('./Config');
const Discord = require('./discord/discord');
const BotError = require('./errors/BotError');
const Bot = require('./gpu/bot');

puppeteer.use(StealthPlugin());
let browserInstance;

/**
 * @description Init a GPU browser+page
 * @param {Object} config A config
 */
async function initBrowser(config) {
  try {
    if (!browserInstance) {
      for (const browser of config.browsers) {
        if (fs.existsSync(browser.path)) {
          browserInstance = await puppeteer.launch({
            executablePath: browser.path,
            headless: false,
          });
          break;
        }
      }
      if (!browserInstance) {
        throw new DiscordError('No Chrome detected');
      }
      browserInstance.on('disconnected', () => {
        browserInstance = null;
      });
    }
  } catch (e) {
    console.log(e);
    throw new BotError('Browser init failed', e);
  }
}

const spinner = ora({
  interval: 60,
  prefixText: '\n',
  text: 'Waiting for new GPUs..',
  discardStdin: false,
  spinner: 'dots4',
});

/**
 * @description Main routine: go to the GPU's URL and try to add it to cart
 * @returns {Promise} Wait for a GPU to be fully loaded+tagged
 */
async function handleGPU(rawGPU, config) {
  try {
    await initBrowser(config);
    spinner.stop();

    const bot = await (new Bot(config))
      .init(new GPU(rawGPU), browserInstance);
    bot.process(config)
      .catch((e) => {})
      .finally(() => {
        setTimeout(() => spinner.start(), 4000);
      });
  } catch (e) {}
}
/**
 * @description Init the Discord web socket
 * @returns {Promise} Wait for the web socket to be init
 */
async function initDiscord(selectedModels, config) {
  await (new Discord(selectedModels, handleGPU, config))
    .init()
    .catch((e) => {
      process.exit(-1);
    });
}
/**
 * @description Init the config object
 * @returns {Promise} Wait for the config to be init
 */
async function initConfig() {
  return (new Config())
    .initConfig()
    .catch((e) => {
      process.exit(-1);
    });
}

(async () => {
  try {
    const config = await initConfig();
    const selectedModels = await Config.modelPrompt(config.models).run();
    await initDiscord(selectedModels, config);
    spinner.start();
  } catch (e) {
    process.exit(-1);
  }
})();
