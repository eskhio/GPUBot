/* eslint-disable no-multi-assign */
const {
  MultiSelect,
  Confirm,
  Input,
  Password,
} = require('enquirer');

const conf = module.exports = {
  modelPrompt: () => new MultiSelect({
    name: 'value',
    message: 'GPU models',
    limit: 7,
    choices: conf.models,
  }),
  retryPrompt: async (error, fnToRetry) => new Confirm({
    name: 'question',
    message: `${error}, retry?`,
  }).run()
    .then(async (answer) => {
      if (answer) return fnToRetry();
      throw error;
    }),
  promptMail: () => new Input({
    name: 'email',
    message: 'Discord email',
  }),
  promptPass: () => new Password({
    name: 'pwd',
    message: 'Discord password',
  }),

  models: [
    '3060',
    '3060ti',
    '3070',
    '3070ti',
    '3080',
    '3080ti',
    'test',
  ],
  vendorRegex: /cybertek|cdisco|ldlc|ruedu|grosbill|bavar|top\s?achat/,
  authorizations: {
    providers: {
      ldlc: '',
      rdc: '',
      gb: '',
    },
  },
  webSockets: {
    discord: {
      payload: {
        op: 2,
        d: {
          intent: 513,
          properties: {
            $os: 'linux',
            $browser: 'chrome',
            $device: 'chrome',
          },
        },
      },
    },
  },
  urls: {
    discord: {
      host: 'https://discord.com/api/v9/channels/',
      main: (model) => `${conf.urls.discord.host}${conf.urls.discord[model]}/messages?limit=10`,
      3060: '798564803874521169',
      '3060ti': '782895101180772372',
      3070: '776917612323667988',
      '3070ti': '798564919939039305',
      3080: '753137771593596979',
      '3080ti': '798565000583053313',
      test: '958385054801887292',
    },
  },
  providers: {
    ldlc: {
      urls: {
        login: 'https://secure2.ldlc.com/fr-fr/Login/Login?returnUrl=%2Ffr-fr%2FAccount',
      },
      selectors: {
        addCart: '.add-to-cart-bloc .add-to-cart',
        unavailable: '[data-stock-web="9"]',
        success: '.product-add .msg',
      },
      regex: {
        addCart: {
          success: 'A BIEN ÉTÉ AJOUTÉ AU PANIER',
        },
      },
    },
    rdc: {
      urls: {
        login: 'https://www.grosbill.com/compte.aspx?login=1&from=/',
      },
      selectors: {
        addCart: '#add-product:not([style="display:none;"])',
        success: '.popup-add-valid .title',
        unavailable: '#product__boutique_epuise_txt:not([style="display:none;"])',
        rgpdBypass: '#rgpd-btn-index-continue',
      },
      regex: {
        addCart: {
          success: 'a bien été ajouté au panier',
        },
      },
    },
    gb: {
      urls: {
        login: 'https://www.grosbill.com/compte.aspx?login=1&from=/',
      },
      selectors: {
        addCart: '#_ctl0_ContentPlaceHolder1_btn_add_panier',
        success: '.txt-ajout-panier',
        unavailable: '.disable #_ctl0_ContentPlaceHolder1_btn_add_panier_2',
        rgpdBypass: '#_ctl0_CookieConsentButton',
      },
      regex: {
        addCart: {
          success: 'a bien été ajouté au panier',
        },
      },
    },
    cd: {
      urls: {
        login: 'https://order.cdiscount.com/Account/LoginLight.html?referrer=',
      },
      selectors: {
        addCart: '#fpAddBsk:not(.clickDisabled)',
        success: '.raAddMsgWithCheck',
        unavailable: '#fpAddBsk.clickDisabled',
        captcha: '#captcha-form',
      },
      regex: {
        addCart: {
          success: 'Ajouté au panier',
        },
      },
    },
    topachat: {
      urls: {
        login: 'https://www.grosbill.com/compte.aspx?login=1&from=/',
      },
      selectors: {
        addCart: '.panier input[type=submit]',
        unavailable: '.en-rupture',
        success: '.orderbar__total',
        rgpdBypass: '#cookie-wall-refuse',
      },
      regex: {
        addCart: {
          success: 'Montant total de tes articles',
        },
      },
    },
    cybertek: {
      urls: {
        login: 'https://www.cybertek.fr/boutique/compte.aspx?login=1',
      },
      selectors: {
        addCart: '.ajout-fiche-produit:not(.disable) [id*="btn_add_panier"]',
        unavailable: '.ajout-fiche-produit.disable',
        success: '.txt-ajout-panier',
        rgpdBypass: '#cookie-wall-refuse',
      },
      regex: {
        addCart: {
          success: 'A BIEN ÉTÉ AJOUTÉ AU PANIER',
        },
      },
    },
    bavar: {
      selectors: {
        getShopLink: '#_ctl0_ContentPlaceHolder1_btn_add_panier',
        addCart: '.panier input[type=submit]',
        unavailable: 'unavailable',
      },
    },
  },
  browser: {
    chrome: {
      x86: 'C:\\Program Files\(x86)\\Google\\Chrome\\Application\\chrome.exe',
      x64: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    },
  },
};
