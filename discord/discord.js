/* eslint-disable max-classes-per-file */
const ora = require('ora');
const WebSocket = require('ws');

const puppeteer = require('puppeteer-extra');
const conf = require('../conf');
const DiscordEvents = require('../events/GPUEvents');
const DiscordError = require('../errors/DiscordError');
puppeteer.use(require('puppeteer-extra-plugin-stealth')());
const fs = require("fs");



/**
 * A GPU
 * @class Backup
 */
class Discord extends DiscordEvents {
  constructor(selectedModels) {
    super();
    this.selectedModelsID = selectedModels.map((selectedModel) => conf.urls.discord[selectedModel]);
    this.spinner = ora({
      interval: 1, prefixText: '\n', text: 'Fetching token', discardStdin: false,
    });
  }

  async init(handleGPU) {
    this.spinner.start();
    this.on('gpuDiscordFetched', (data) => {
      this.spinner.stop();
      handleGPU(data);
    });
    return this.initToken()
      .catch((e) => { throw e; })
      .then(async () => {
        this.spinner.color = 'yellow';
        this.spinner.text = 'Opening discord websocket..';
        await this.initSocket();
      });
  }

  async initToken() {
    if (fs.existsSync(conf.browser.chrome.x64)) {
      this.browser = await puppeteer.launch({
        executablePath: conf.browser.chrome.x64,
        headless: true,
      });
    } else if (fs.existsSync(conf.browser.chrome.x86)) {
      this.browser = await puppeteer.launch({
        executablePath: conf.browser.chrome.x86,
        headless: true,
      });
    } else {
      this.spinner.stop();
      throw new DiscordError('No Chrome detected');
    }
    if (conf.webSockets.discord.payload.d.token) return true;
    await this.spinner.stop();
    return this.fetchToken()
      .catch((e) => { throw e; });
  }

  async initSocket() {
    conf.webSockets.discord.payload.d.token = this.token;
    return new Promise((resolve) => {
      this.ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');
      this.ws.on('message', (data) => this.receive(data));
      this.ws.on('open', () => this.ws.send(JSON.stringify(conf.webSockets.discord.payload)));
      this.browser.close();
      this.spinner.text = 'Websocket opened..';
      this.spinner.text = 'Waiting for new GPUs..';
      this.spinner.color = 'green';
      resolve();
    });
  }

  async askForCredentials() {
    console.log('-----------');
    console.log('Discord login');
    console.log('-----------');
    let email;
    let pwd;
    try {
      email = await conf.promptMail().run();
      pwd = await conf.promptPass().run();
    } catch (e) {
      console.log(e);
    }
    console.log('-----------');
    if (email && pwd) return { email, pwd };
    throw new DiscordError('Both fields are mandatory');
  }

  parseLoginToken(response) {
    const json = JSON.parse(response.payloadData);
    if (json.d && json.d.token) {
      const { token } = json.d;
      return token;
    }
    return null;
  }

  async openLoginPage() {
    this.spinner.text = 'Loading Discord login...';
    this.loginPage = await this.browser.newPage();
    // eslint-disable-next-line no-underscore-dangle
    this.loginPage._client.on('Network.webSocketFrameSent', ({ response }) => {
      if (this.parseLoginToken(response)) {
        this.token = this.parseLoginToken(response);
        this.emit('tokenFetched', this.token);
      }
    });
    return this.loginPage.goto('https://discord.com/login', { waitUntil: 'networkidle0' });
  }

  async fillAndSubmitLogin({ email, pwd }) {
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
      await submitBtn.click({ waitUntil: 'networkidle0' });
      this.spinner.text = 'Form submitted';
      return true;
    }).catch((e) => { throw new DiscordError('Filling login form failed', e); });
  }

  async parseLoginResult() {
    this.spinner.text = 'Checking login result..';
    return Promise.race([
      this.loginPage.waitForSelector('[class*=errorMessage]'),
      this.loginPage.waitForSelector('[data-hcaptcha-response]'),
      new Promise((r) => { setTimeout(r, 10000); }),
    ])
      .then(async () => {
        if (await this.loginPage.$('[class*=errorMessage]')) { throw new DiscordError('Incorrect login'); }
        if (await this.loginPage.$('[data-hcaptcha-response]')) { throw new DiscordError('Captcha login'); }
        this.spinner.text = 'Logged in!';
        return true;
      })
      .catch((e) => { throw e; });
  }

  async login() {
    let credentials;
    try {
      credentials = await this.askForCredentials();
      this.spinner.color = 'yellow';
      await this.openLoginPage();
      await this.fillAndSubmitLogin(credentials);
      await this.parseLoginResult().catch((e) => { throw e; });
      return true;
    } catch (e) {
      this.emit('loginFail', e);
      this.spinner.stop();
      return conf.retryPrompt(e, async () => this.login().catch(() => { throw e; }));
    }
  }

  async fetchToken() {
    return new Promise(async (resolve, reject) => {
      await this.login()
        .then(async () => {
          resolve();
        })
        .catch((e) => { reject(e); });
    });
  }

  keepAlive(ms) {
    return setInterval(() => {
      this.ws.send(JSON.stringify({
        op: 1,
        d: null,
      }));
    }, ms * 0.4);
  }

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
        this.spinner.stop();
        this.emit('gpuDiscordFetched', d);
      }
    }
  }
}

module.exports = Discord;
