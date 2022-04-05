require('dotenv').config();

/* eslint-disable max-classes-per-file */
const ora = require('ora');
const WebSocket = require('ws');

const puppeteer = require('puppeteer-extra');
const fs = require('fs');
const Config = require('../Config');
const DiscordEvents = require('../events/GPUEvents');
const DiscordError = require('../errors/DiscordError');
puppeteer.use(require('puppeteer-extra-plugin-stealth')());

/**
 * A GPU
 * @class Backup
 */
class Discord extends DiscordEvents {
  constructor(selectedModels, handleGPU, config) {
    super();
    this.selectedModelsID = selectedModels.map((selectedModel) => config.urls.discord[selectedModel]);
    this.spinner = ora({
      interval: 1,
      prefixText: '\n',
      text: 'Fetching token',
      discardStdin: false,
    });
    this.config = config;
    this.on('gpuDiscordFetched', (data) => {
      this.spinner.stop();
      handleGPU(data, this.config);
    });
  }

  /**
   * @description Init a Discord socket
   * @returns {Promise} A token + a socket
   */
  async init() {
    this.spinner.start();
    return this.initToken()
      .catch((e) => {
        throw e;
      })
      .then(async () => {
        this.spinner.color = 'yellow';
        this.spinner.text = 'Opening discord websocket..';
        await this.initSocket();
      });
  }

  /**
   * @description Init a browser
   */
  async initBrowser() {
    for (const browser of this.config.browsers) {
      if (fs.existsSync(browser.path)) {
        this.browser = await puppeteer.launch({
          executablePath: browser.path,
          headless: true,
        });
        break;
      }
    }
    if (!this.browser) {
      this.spinner.stop();
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
    await this.initBrowser();
    await this.spinner.stop();
    return this.fetchToken()
      .catch((e) => {
        throw e;
      });
  }

  /**
   * @description Fetch a Discord's token
   * @returns {Promise} Logged in
   */
  async fetchToken() {
    return this.login()
      .catch((e) => {
        throw e;
      });
  }

  /**
   * @description Init a Discord socket
   * @returns {Promise} A Discord socket
   */
  async initSocket() {
    this.config.webSockets.discord.payload.d.token = this.token;
    return new Promise((resolve) => {
      this.ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');
      this.ws.on('message', (data) => this.receive(data));
      this.ws.on('open', () => this.ws.send(JSON.stringify(this.config.webSockets.discord.payload)));
      if (this.browser) this.browser.close();
      this.spinner.text = 'Websocket opened..';
      this.spinner.stop();
      resolve();
    });
  }

  /**
   * @description Ask for Discord's credentials
   * @returns {Object} email+pwd
   */
  async askForCredentials() {
    console.log('-----------');
    console.log('Discord login');
    console.log('-----------');
    let email;
    let pwd;
    try {
      email = await Config.promptMail().run();
      pwd = await Config.promptPass().run();
    } catch (e) {
      console.log(e);
    }
    console.log('-----------');
    if (email && pwd) {
      return {
        email,
        pwd,
      };
    }
    throw new DiscordError('Both fields are mandatory');
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
   * @returns {Promise} A Discord login page opened
   */
  async openLoginPage() {
    this.spinner.text = 'Loading Discord login...';
    this.loginPage = await this.browser.newPage();
    // eslint-disable-next-line no-underscore-dangle
    this.loginPage._client.on('Network.webSocketFrameSent', ({
      response,
    }) => {
      if (this.parseLoginToken(response)) {
        this.token = this.parseLoginToken(response);
        this.emit('tokenFetched', this.token);
      }
    });
    return this.loginPage.goto('https://discord.com/login', {
      waitUntil: 'networkidle0',
    });
  }

  /**
   * @description Fill and submit Discord's login form
   * @param {Object} email+pwd
   * @returns {Promise} Login form submitted
   */
  async fillAndSubmitLogin({
    email,
    pwd,
  }) {
    return Promise.all([
      this.loginPage.waitForSelector('input[name="email"]'),
      this.loginPage.waitForSelector('input[name="password"]'),
      this.loginPage.waitForSelector('button[type=submit]'),
    ]).then(async () => {
      this.spinner.start();
      this.spinner.text = 'Filling form..';
      const emailField = await this.loginPage.$('input[name="email"]');
      const pwdField = await this.loginPage.$('input[name="password"]');
      const submitBtn = await this.loginPage.$('button[type=submit]');
      await emailField.type(email);
      await pwdField.type(pwd);
      await submitBtn.click({
        waitUntil: 'networkidle0',
      });
      this.spinner.text = 'Form submitted';
    }).catch((e) => {
      throw new DiscordError('Filling login form failed', e);
    });
  }

  /**
   * @description Parse a Discord's login result
   * @returns {Promise} Login response
   */
  async parseLoginResult() {
    this.spinner.text = 'Checking login result..';
    return Promise.race([
      this.loginPage.waitForSelector('[class*=errorMessage]'),
      this.loginPage.waitForSelector('[data-hcaptcha-response]'),
      new Promise((r) => {
        setTimeout(r, 10000);
      }),
    ])
      .then(async () => {
        if (await this.loginPage.$('[class*=errorMessage]')) {
          throw new DiscordError('Incorrect login');
        }
        if (await this.loginPage.$('[data-hcaptcha-response]')) {
          throw new DiscordError('Captcha login');
        }
        this.spinner.text = 'Logged in!';
      })
      .catch((e) => {
        throw e;
      });
  }

  /**
   * @description Discord login
   */
  async login() {
    let credentials;
    try {
      credentials = await this.askForCredentials();
      this.spinner.color = 'yellow';
      await this.openLoginPage();
      await this.fillAndSubmitLogin(credentials);
      return this.parseLoginResult().catch((e) => {
        throw e;
      });
    } catch (e) {
      this.emit('loginFail', e);
      this.spinner.stop();
      return Config.retryPrompt(e, async () => this.init().catch(() => {
        throw e;
      }));
    }
  }

  /**
   * @description Keep a WS conn alive
   * @param {int} ms
   */
  keepAlive(ms) {
    return setInterval(() => {
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
