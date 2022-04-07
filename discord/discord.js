require('dotenv').config();

/* eslint-disable max-classes-per-file */
const WebSocket = require('ws');

const puppeteer = require('puppeteer-extra');
const fs = require('fs');
const Config = require('../Config');
const DiscordEvents = require('../events/DiscordEvents');
const DiscordError = require('../errors/DiscordError');
puppeteer.use(require('puppeteer-extra-plugin-stealth')());
const chalk = require('chalk');
/**
 * A GPU
 * @class Backup
 */
class Discord extends DiscordEvents {
  constructor(config) {
    super();
    this.config = config;
    this.spinner = Config.discordSpinner("Discord init");
  }

  /**
   * @description Init a Discord socket
   * @returns {Promise} A token + a socket
   */
  async init(selectedModels) {
    console.log("\n");
    this.spinner.start();
    this.selectedModels = selectedModels;
    this.selectedModelsID = this.selectedModels.map((selectedModel) => this.config.urls.discord[selectedModel]);
    if(process.env.DTOKEN || this.token) {
      this.token = process.env.DTOKEN || this.token;
      this.config.webSockets.discord.payload.d.token = this.token;
    } else {
      await this.initBrowser().catch((e) => { 
        this.spinner.fail(chalk.red(`Check your chrome installation. Checked into:\n`));
        this.config.browsers.map((b) => console.log(chalk.red(`- ${b.path}`)));
        throw e; 
      });
      await this.initToken()
        .catch((e) => {
          throw e;
        })
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
    try {
      for (const browser of this.config.browsers) {
        if (fs.existsSync(browser.path)) {
          this.browser = await puppeteer.launch({
            executablePath: browser.path,
          });
          this.emit("discordBrowserOpened");
          break;
        }
      }
      if (!this.browser) {
        throw new DiscordError('No Chrome detected');
      }
    } catch (e) {
      throw e;
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
      let credentials;
      if(this.token) return true;
      else if (process.env.DLOGIN && process.env.DPWD) credentials = { email: process.env.DLOGIN, pwd: process.env.DPWD };
      else credentials = await this.askForCredentials()
        .catch((e) => {
          throw e;
        });
      this.spinner.start();
      await this.openLoginPage();
      await this.fillAndSubmitLogin(credentials);
      return this.parseLoginResult()
        .catch((e) => {
          throw e;
        });
    } catch (e) {
      this.spinner.stop();
      this.emit('loginFail', e);
      return Config.retryPrompt(e, () => this.login())
    }
  }

  /**
   * @description Init a Discord socket
   * @returns {Promise} A Discord socket opened
   */
  async initSocket() {
    this.spinner.succeed("Discord websocket opened");
    if(!this.ws) {
      this.ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');
      this.ws.on('message', (data) => this.receive(data));
      this.ws.on('open', () => this.ws.send(JSON.stringify(this.config.webSockets.discord.payload)));
      if(this.browser) await this.browser.close();
    }
    return true;
  }

  /**
   * @description Ask for Discord's credentials
   * @returns {Object} email+pwd
   */
  async askForCredentials() {
    this.spinner.info("Login")
    console.log('--------------');
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
   * @returns {Promise} A Discord login page opened + a listener for web socket activity opened
   */
  async openLoginPage() {
    this.spinner.text = 'Loading Discord login...';
    this.loginPage = await this.browser.newPage();
    this.loginPage._client.on('Network.webSocketFrameSent', ({
      response,
    }) => {
      let parsedResponse = this.parseLoginToken(response)
      if (parsedResponse) {
        this.token = parsedResponse;
        this.config.webSockets.discord.payload.d.token = this.token;
        this.emit('tokenFetched', this.token);
        this.spinner.succeed("Token fetched");
        this.spinner.start("Opening socket (takes some time)..");
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
    this.spinner.start();
    return Promise.all([
      this.loginPage.waitForSelector('input[name="email"]'),
      this.loginPage.waitForSelector('input[name="password"]'),
      this.loginPage.waitForSelector('button[type=submit]'),
    ]).then(async () => {
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
   * @description Wait for the tokenFetched event to be fired
   * @returns {Promise} The tokenFetched event has been fired
   */
  isLoggedIn(){
    return new Promise((resolve) => this.once('tokenFetched', resolve));
  }

  /**
   * @description Parse a Discord's login result
   * @returns {Promise} Login result parsed
   */
  async parseLoginResult() {
    this.spinner.text = 'Checking login result..';
    return Promise.race([
        this.isLoggedIn().then(() => new Promise(resolve => setTimeout(resolve, 10000))),
        this.loginPage.waitForSelector('[class*=errorMessage]'),
        this.loginPage.waitForSelector('[data-hcaptcha-response]')
      ])
      .then(async () => {
        if (await this.loginPage.$('[class*=errorMessage]')) {
          throw new DiscordError('Incorrect login');
        } else if (await this.loginPage.$('[data-hcaptcha-response]')) {
          throw new DiscordError('Captcha login');
        }
        this.spinner.succeed("Logged in");
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
