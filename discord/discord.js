require('dotenv').config();

/* eslint-disable max-classes-per-file */
const WebSocket = require('ws');

const puppeteer = require('puppeteer-extra');
const fs = require('fs');
const chalk = require('chalk');
const Config = require('../Config');
const DiscordEvents = require('../events/DiscordEvents');
const DiscordError = require('../errors/DiscordError');
puppeteer.use(require('puppeteer-extra-plugin-stealth')());
/**
 * A GPU
 * @class Backup
 */
class Discord extends DiscordEvents {
  constructor(config) {
    super();
    this.config = config;
    this.spinner = Config.discordSpinner('Discord init');
  }

  /**
   * @description Init a Discord socket
   * @returns {Promise} A token + a socket
   */
  async init(selectedModels) {
    console.log('\n');
    this.spinner.start();
    this.selectedModels = selectedModels;
    this.selectedModelsID = this.selectedModels.map((selectedModel) => this.config.urls.discord[selectedModel]);
    if (process.env.DTOKEN || this.token) {
      this.token = process.env.DTOKEN || this.token;
      this.config.webSockets.discord.payload.d.token = this.token;
    } else {
      await this.initBrowser().catch((e) => {
        this.spinner.fail(chalk.red('Check your chrome installation. Checked into:\n'));
        this.config.browsers.map((b) => console.log(chalk.red(`- ${b.path}`)));
        throw e;
      });
      await this.initToken()
        .catch((e) => {
          throw e;
        });
    }
    this.spinner.start();
    this.spinner.color = 'yellow';
    this.spinner.text = 'Opening Discord websocket..';
    return this.initSocket();
  }

  /**
   * @description Init a browser instance
   * @returns {Object} A browser instance
   */
  async initBrowser() {
    for (const browser of this.config.browsers) {
      if (fs.existsSync(browser.path)) {
        this.browser = await puppeteer.launch({
          executablePath: browser.path,
          headless: false,
        });
        this.emit('discordBrowserOpened');
        break;
      }
    }
    if (!this.browser) {
      throw new DiscordError('No Chrome detected');
    }
  }

  /**
   * @description Init a Discord token
   */
  async initToken() {
    if (process.env.DTOKEN) {
      this.token = process.env.DTOKEN;
      return true;
    }
    return this.login().catch((e) => { throw e; });
  }

  /**
   * @description Discord login
   * @returns {Promise} Logged in (or not)
   */
  async login() {
    try {
      if (this.token) return true;
      this.spinner.start();
      await this.openLoginPage();
      return this.parseLoginResult()
        .catch((e) => {
          throw e;
        });
    } catch (e) {
      this.spinner.stop();
      this.emit('loginFail', e);
      return Config.retryPrompt(e, () => this.login());
    }
  }

  /**
   * @description Init a Discord socket
   * @returns {Promise} A Discord socket opened
   */
  async initSocket() {
    this.spinner.succeed('Discord websocket opened');
    if (!this.ws) {
      this.ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');
      this.ws.on('message', (data) => this.receive(data));
      this.ws.on('open', () => this.ws.send(JSON.stringify(this.config.webSockets.discord.payload)));
      if (this.browser) await this.browser.close();
    }
    return true;
  }

  /**
   * @description Parse a Discord's token within a login response
   * @param {Object} response A Discord's login response
   * @returns {String} A Discord token
   */
  parseLoginToken(response) {
    const json = JSON.parse(response.payloadData);
    if (json.d && json.d.token) {
      const {
        token,
      } = json.d;
      return token;
    }
    return null;
  }

  /**
   * @description Open Discord's login page
   * @returns {Promise} A Discord login page opened + a listener for web socket activity opened
   */
  async openLoginPage() {
    this.spinner.text = 'Loading Discord login...';
    this.loginPage = await this.browser.newPage();
    // eslint-disable-next-line no-underscore-dangle
    this.loginPage._client.on('Network.webSocketFrameSent', ({
      response,
    }) => {
      const parsedResponse = this.parseLoginToken(response);
      if (parsedResponse) {
        this.token = parsedResponse;
        this.config.webSockets.discord.payload.d.token = this.token;
        this.emit('tokenFetched', this.token);
        this.spinner.succeed('Token fetched');
        this.spinner.start('Opening socket (takes some time)..');
      }
    });
    return this.loginPage.goto('https://discord.com/login', {
      waitUntil: 'networkidle0',
    });
  }

  /**
   * @description Wait for the tokenFetched event to be fired
   * @returns {Promise} The tokenFetched event has been fired
   */
  isLoggedIn() {
    return new Promise((resolve) => {
      this.once('tokenFetched', resolve);
    });
  }

  /**
   * @description Parse a Discord's login result
   * @returns {Promise} Login result parsed
   */
  async parseLoginResult() {
    this.spinner.text = 'Checking login result..';
    return Promise.race([
      this.isLoggedIn().then(() => new Promise((resolve) => { setTimeout(resolve, 10000); })),
      this.loginPage.waitForSelector('[class*=errorMessage]'),
      this.loginPage.waitForSelector('[data-hcaptcha-response]'),
    ])
      .then(async () => {
        if (await this.loginPage.$('[class*=errorMessage]')) {
          throw new DiscordError('Incorrect login');
        } else if (await this.loginPage.$('[data-hcaptcha-response]')) {
          throw new DiscordError('Captcha login');
        }
        this.spinner.succeed('Logged in');
      })
      .catch(async (e) => {
        this.spinner.fail();
        return Config.retryPrompt(e, () => this.login());
      });
  }

  /**
   * @description Keep a WS conn alive
   * @param {int} ms
   */
  keepAlive(ms) {
    setInterval(() => {
      this.ws.send(JSON.stringify({
        op: 1,
        d: null,
      }));
    }, ms * 0.4);
  }

  /**
   * @description Receive a WS message
   * @returns {Promise} Logged in
   */
  receive(data) {
    const payload = JSON.parse(data);
    const {
      t,
      op,
      d,
    } = payload;
    if (op === 10) {
      const {
        heartbeat_interval: heartbeatInterval,
      } = d;
      this.keepAlive(heartbeatInterval);
    }
    if (t === 'MESSAGE_CREATE') {
      if (this.selectedModelsID.includes(d.channel_id)) {
        this.emit('gpuDiscordFetched', d);
      }
    }
  }
}

module.exports = Discord;
