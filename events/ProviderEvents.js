const EventEmitter = require('events');
const moment = require('moment');
const chalk = require('chalk');

class GPUEvents extends EventEmitter {
  constructor() {
    super();
    this.on('providerConfigInit', (gpu) => {
      this.emitProviderStatus('Provider config init success', gpu);
    });
    this.on('providerConfigCheck', (gpu) => {
      this.emitProviderStatus('Provider config init checking', gpu);
    });
    this.on('providerUpdateConfig', (gpu) => {
      this.emitProviderStatus('Provider config update', gpu);
    });
    this.on('providerConfigCheckFail', (gpu) => {
      this.emitProviderStatus('Provider config init checking', gpu);
    });
    this.on('providerInitConfigFail', (error, gpu) => {
      this.emitProviderStatus('Provider config init failed', gpu, error);
    });
    this.on('providerInit', (gpu) => {
      this.emitProviderStatus('Provider init success', gpu);
    });
    this.on('providerInitFail', (error, gpu) => {
      this.emitProviderStatus('Provider init failed', gpu, error);
    });
  }

  emitProviderStatus(status, gpu, error) {
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
