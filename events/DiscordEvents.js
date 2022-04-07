const EventEmitter = require('events');
const moment = require('moment');
const chalk = require('chalk');
const GPUEvents = require('./GPUEvents');

class DiscordEvents extends EventEmitter {
  constructor() {
    super();
    this.on('discordBrowserOpened', () => {
      // this.emitDiscordStatus('Discord browser opened', null);
    });
    this.on('discordBrowserOpenFail', (error) => {
      // this.emitDiscordStatus('Discord browser open failed', error);
    });
    this.on('gpuDiscordFetched', (gpu) => {
      // this.emitDiscordStatus('GPU fetched', gpu);
    });
    this.on('tokenFetched', () => {
      // this.emitDiscordStatus('Discord token fetched');
    });
    this.on('tokenCaptcha', (error) => {
      this.emitDiscordStatus('Token captcha', error);
    });
    this.on('loginCaptcha', (error) => {
      this.emitDiscordStatus('Login captcha', error);
    });
    this.on('loginFail', (error) => {
      // this.emitDiscordStatus('Discord login fail', error);
    });
  }

  emitDiscordStatus(status, error) {
    let color;
    let discordtoJSON = {};
    discordtoJSON.status = status;
    if (error) {
      discordtoJSON = { ...discordtoJSON, error: { ...error, stack: error.stack } };
      color = '#C70039';
    }
    console.log(
      chalk.hex(color || '#FFFFF')(JSON.stringify(discordtoJSON, null, 4)),
    );
  }
}
module.exports = DiscordEvents;
