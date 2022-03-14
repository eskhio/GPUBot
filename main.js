/* eslint-disable no-undef */
const puppeteer = require('puppeteer-extra');
const GPU = require('./gpu/gpu');
const conf = require('./conf');
const Discord = require('./discord/discord');

async function handleGPU(rawGPU) {
  (new GPU(rawGPU))
    .init()
    .then((parsedGPU) => {
      parsedGPU.bot.process().catch((e) => { });
    })
    .catch((e) => { });
}
async function initDiscord(selectedModels) {
  await (new Discord(selectedModels))
    .init(handleGPU)
    .catch((e) => { console.log(e); process.exit(-1); });
}
(async () => {
  conf.modelPrompt()
    .run()
    .then(async (selectedModels) => initDiscord(selectedModels))
    .catch((e) => { console.log(e); process.exit(-1); });
})();
