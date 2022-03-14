/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */
/* eslint-disable no-multi-assign */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const conf = require('../conf');
const GPUEvents = require('../events/GPUEvents');

puppeteer.use(StealthPlugin());
const bavar = module.exports = {
  process: async (gpu) => bavar.getGPURealData(gpu).catch((e) => { console.log(e); throw e; }),
  openGPU: async (page, openGPUSelector) => {
    await page.click(`.${openGPUSelector}`);
  },
  getRealURL: async (page) => {
    if (/bavar/.test(page.url())) {
      await bavar.openGPU(page, (await bavar.parseGoToGPUButton(page)).class);
      await page.waitForFunction(
        (vendorRegex) => new RegExp(vendorRegex).test(location.href),
        {},
        conf.vendorRegex,
      );
    }
    return page.url();
  },
  open: async (page, url) => page.goto(url, { waitUntil: 'networkidle0' }),
  getGPURealData: async (gpu) => {
    const pageInstance = await gpu.bot.page;

    await bavar.open(pageInstance, gpu.url);
    new GPUEvents().emit('gpuWaitingForVendor', gpu);
    const realData = {
      vendor: await bavar.getRealVendor(pageInstance),
      url: await bavar.getRealURL(pageInstance),
    };
    new GPUEvents().emit('gpuGotVendor', gpu);
    return realData;
  },
  getRealVendor: async (page) => {
    const vendorUrl = /bavar/.test(page.url())
      ? (await bavar.getVendorButton(page)).innerText
      : page.url();
    return bavar.parseVendor(vendorUrl);
  },
  getVendorButton: async (page) => {
    const res = await bavar.parseGoToGPUButton(page);
    return res;
  },
  parseGoToGPUButton: async (page) => page.evaluate(() => {
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
  parseVendor: (text) => {
    if (/ldlc/i.test(text)) return 'ldlc';
    if (/rue?\sdu?\scommerce/i.test(text)) return 'rdc';
    if (/grosb/i.test(text)) return 'gb';
    if (/cdisco/i.test(text)) return 'cd';
    if (/top\s?achat/i.test(text)) return 'topachat';
    if (/cybertek/i.test(text)) return 'cybertek';
    throw new Error(`Unknown vendor: ${text.match(/Acheter sur (.*)/)[1]}`);
  },
};
