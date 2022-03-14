const EventEmitter = require('events');
const moment = require('moment');
const chalk = require('chalk');
const conf = require('../conf');

class GPUEvents extends EventEmitter {
  constructor() {
    super();
    this.on('gpuDiscordFetched', (gpu) => {
      this.emitDiscordStatus('GPU discord fetched', gpu);
    });
    this.on('tokenFetched', (token) => {
      console.log(
        chalk.hex('#6B8E23')(JSON.stringify({ status: 'Token fetched', date: new moment().format('HH:mm:ss'), token }, null, 4)),
      );
      conf.authorizations.discord = token;
      conf.webSockets.discord.payload.d.token = token;
    });
    this.on('tokenFetchFail', (error) => {
      this.emitDiscordStatus('Incorrect login', null, error);
    });
    this.on('tokenCaptcha', (error) => {
      this.emitDiscordStatus('Token captcha', null, error);
    });
  }

  emitDiscordStatus(status, gpu, error) {
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
module.exports = GPUEvents;
