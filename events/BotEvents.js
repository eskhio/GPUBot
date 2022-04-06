const EventEmitter = require('events');
const moment = require('moment');
const chalk = require('chalk');

class BotEvents extends EventEmitter {
  constructor() {
    super();
    this.on('botConfigInit', (gpu) => {
      this.emitBotStatus('Bot config init success', gpu);
    });
    this.on('botConfigCheck', (gpu) => {
      this.emitBotStatus('Bot config checking', gpu);
    });
    this.on('botUpdateConfig', (gpu) => {
      this.emitBotStatus('Bot config update', gpu);
    });
    this.on('botConfigCheckFail', (gpu) => {
      this.emitBotStatus('Bot config checking fail', gpu);
    });
    this.on('botInitConfigFail', (error, gpu) => {
      this.emitBotStatus('Bot config init failed', gpu, error);
    });
    this.on('botInit', (gpu) => {
      this.emitBotStatus('Bot init success', gpu);
    });
    this.on('botInitFail', (error, gpu) => {
      this.emitBotStatus('Bot init failed', gpu, error);
    });
    this.on('botcheckStatusFail', (error, gpu) => {
      this.emitBotStatus('Bot check status failed', gpu, error);
    });
  }

  emitBotStatus(status, gpu, error) {
    let color;
    let gputoJSON;
    if (gpu) {
      gputoJSON = {
        id: gpu?.id,
        price: gpu?.price,
        vendor: gpu?.vendor,
        url: gpu?.url,
        status,
        date: new moment().format('HH:mm:ss'),
      };
      color = gpu.color;
    }
    if (error) {
      gputoJSON = { ...gputoJSON, error: { ...error, stack: error.stack } };
      color = '#C70039';
    }

    console.log(
      chalk.hex(color || '#FFFFF')(JSON.stringify(gputoJSON, null, 4)),
    );
  }
}
module.exports = BotEvents;
