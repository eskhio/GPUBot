/* eslint-disable no-param-reassign */
/* eslint-disable new-cap */
const EventEmitter = require('events');
const moment = require('moment');
const chalk = require('chalk');

class GPUEvents extends EventEmitter {
  constructor() {
    super();
    this.on('gpuBypassingRGPD', (gpu) => {
      this.emitGPUStatus('GPU RGPD', gpu);
    });
    this.on('gpuPageOpened', (gpu) => {
      this.emitGPUStatus('GPU page opened', gpu);
    });
    this.on('gpuParsed', (gpu) => {
      this.emitGPUStatus('GPU parsed', gpu);
    });
    this.on('gpuWaitingForVendor', (gpu) => {
      this.emitGPUStatus('GPU waiting for vendor page', gpu);
    });
    this.on('gpuGotVendor', (gpu) => {
      this.emitGPUStatus('GPU got vendor page', gpu);
    });
    this.on('gpuFetchingCompleteData', (gpu) => {
      this.emitGPUStatus('GPU fetching real data', gpu);
    });
    this.on('gpuFetchedCompleteData', (gpu) => {
      this.emitGPUStatus('GPU fetched real data', gpu);
    });
    this.on('gpuUpdatedBot', (gpu) => {
      this.emitGPUStatus('GPU updated bot config', gpu);
    });
    this.on('gpuOpened', (gpu) => {
      this.emitGPUStatus('GPU opened', gpu);
    });
    this.on('gpuLoaded', (gpu) => {
      this.emitGPUStatus('GPU loaded', gpu);
    });
    this.on('gpuCaptcha', (gpu) => {
      this.emitGPUStatus('GPU catcha', gpu);
    });
    this.on('gpuCheckingStatus', (gpu) => {
      this.emitGPUStatus('GPU checking status', gpu);
    });
    this.on('gpuAdded', (gpu) => {
      this.emitGPUStatus('GPU added to cart', gpu);
    });
    this.on('gpuAvailable', (gpu) => {
      this.emitGPUStatus('GPU available', gpu);
    });
    this.on('gpuAdding', (gpu) => {
      this.emitGPUStatus('GPU adding to cart', gpu);
    });
    this.on('gpuOutage', (gpu) => {
      this.emitGPUStatus('GPU outage', gpu);
    });
    this.on('loginCaptcha', (gpu) => {
      this.emitGPUStatus('Login captcha', gpu);
    });
    this.on('loginFail', (error) => {
      this.emitGPUStatus('Discord login fail', null, error);
    });
    this.on('gpuParseFail', (error, gpu) => {
      this.emitGPUStatus('GPU parse fail', gpu, error);
    });
    this.on('gpuInitFail', (error, gpu) => {
      this.emitGPUStatus('GPU init fail', gpu, error);
    });
    this.on('gpuLoadFail', (error, gpu) => {
      this.emitGPUStatus('GPU load fail', gpu, error);
    });
    this.on('gpuCheckStatusFail', (error, gpu) => {
      this.emitGPUStatus('GPU check status fail', gpu, error);
    });
    this.on('gpuParseStatusFail', (error, gpu) => {
      this.emitGPUStatus('GPU parse status fail', gpu, error);
    });
    this.on('gpuAddCartFail', (error, gpu) => {
      this.emitGPUStatus('GPU fail add cart', gpu, error);
    });
    this.on('gpuHandleStatusFail', (error, gpu) => {
      this.emitGPUStatus('GPU handle status fail', gpu, error);
    });
  }

  emitGPUStatus(status, gpu, error) {
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
