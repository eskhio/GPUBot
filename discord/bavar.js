/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */
/* eslint-disable no-multi-assign */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const GPUEvents = require('../events/GPUEvents');

puppeteer.use(StealthPlugin());
const bavar = module.exports = {
  process: async (bot) => bavar.getGPURealData(bot).catch((e) => {
    console.log(e);
    throw e;
  }),
  openGPU: async (bot, openGPUSelector) => {
    await bot.page.click(`.${openGPUSelector}`);
  },
  getRealURL: async (bot) => {
    if (/bavar/.test(bot.page.url())) {
      await bavar.openGPU(bot, (await bavar.parseVendorButton(bot)).class);
      await bot.page.waitForFunction(
        (regex) => new RegExp(regex).test(location.href),
        {},
        bot.globalConfig.vendorRegex,
      );
    }
    return bot.page.url();
  },
  open: async (bot) => bot.page.goto(bot.gpu.url, {
    waitUntil: 'networkidle0',
  }),
  getGPURealData: async (bot) => {
    await bavar.open(bot);
    new GPUEvents().emit('gpuWaitingForVendor', bot.gpu);
    const realData = {
      vendor: await bavar.getRealVendor(bot),
      url: await bavar.getRealURL(bot),
    };
    new GPUEvents().emit('gpuGotVendor', bot.gpu);
    return realData;
  },
  getRealVendor: async (bot) => bavar.parseVendor(bot.globalConfig.vendorRegex, await bavar.getRealVendorUrl(bot)),
  getRealVendorUrl: async (bot) => (/bavar/.test(bot.page.url()) ? (await bavar.getVendorButton(bot)).innerText : bot.page.url()),
  getVendorButton: async (bot) => bavar.parseVendorButton(bot),
  parseVendorButton: async (bot) => bot.page.evaluate(() => {
    for (const link of Array.from(document.querySelectorAll('a'))) {
      if (/Acheter sur/.test(link.innerText)) {
        return {
          innerText: link.innerText,
          href: link.href,
          class: link.classList[0],
        };
      }
    }
    throw new Error('Go to GPU button not found');
  }),
  parseVendor: (vendorRegex, vendorUrl) => {
    if (!vendorRegex.test(vendorUrl)) throw new Error(`Unknown vendor: ${vendorUrl.match(/Acheter sur (.*)/)[1]}`);
    return vendorUrl.match(vendorRegex)[0].toLowerCase().replaceAll('\\s');
  },
};
