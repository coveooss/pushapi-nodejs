'use strict';

const PlatformRequestsHelper = require('./PlatformRequestsHelper');

class PushApi extends PlatformRequestsHelper {

  async changeStatus(state) {
    console.log(`Change source status to \x1b[33m\x1b[1m${state}\x1b[0m`, this._now());
    return this._sendRequest(`POST`, `status?statusType=${state}`);
  }

  async deleteOlderThan(orderingId) {
    if (orderingId < Date.now()) {
      return this._sendRequest(`DELETE`, `documents/olderthan?orderingId=${orderingId}`);
    }
  }

  async getLargeFileContainer() {
    let config = this.config;
    return this._sendRequest(`POST`, `https://${config.platform}/v1/organizations/${config.org}/files`).then(
      body => {
        console.log('getLargeFileContainer');
        let resp = (typeof body === 'string') ? JSON.parse(body) : body;

        this.uploadUri = resp.uploadUri;
        this.fileId = resp.fileId;

        this._debug('uploadUri: ', resp.uploadUri);
        this._log('fileId: ', resp.fileId);

        return resp;
      }
    );
  }

  async pushFile(data) {
    data = this.validatePayload(data);

    return await this.pushJsonPayload(data);
  }

  async pushJsonPayload(data) {
    if (this._dryRun) {
      console.log('DRY-RUN: not pushing.');
      return;
    }

    // push
    try {
      await this.getLargeFileContainer();
      await this.uploadFileToAws(this.uploadUri, data);
      await this.sendBatchRequest();
    } catch (err) {
      console.error('\n\nERROR: ', );
      console.error(err.statusCode, err.statusMessage);
      console.error(err.body);
      console.error('\n\n');
    }
  }

  async sendBatchRequest(fileId) {
    return this._sendRequest(`PUT`, `documents/batch?fileId=${fileId || this.fileId}`);
  }

}

module.exports = PushApi;
