import PlatformRequestsHelper from './PlatformRequestsHelper.js';

export default class PushApi extends PlatformRequestsHelper {
  async changeStatus(state) {
    console.log(`Change source status to ${this._highlight(state)}`, this._now());
    return this._sendRequest('POST', `status?statusType=${encodeURIComponent(state)}`);
  }

  async deleteOlderThan(orderingId) {
    if (orderingId < Date.now()) {
      return this._sendRequest('DELETE', `documents/olderthan?orderingId=${orderingId}`);
    }
    return undefined;
  }

  async getLargeFileContainer() {
    const { platform, org } = this.config;
    const resp = await this._sendJsonRequest('POST', `https://${platform}/v1/organizations/${org}/files`);
    console.log('getLargeFileContainer');

    this.uploadUri = resp.uploadUri;
    this.fileId = resp.fileId;

    this._debug('uploadUri: ', resp.uploadUri);
    this._log('fileId: ', resp.fileId);

    return resp;
  }

  async pushFile(data) {
    return this.pushJsonPayload(this.validatePayload(data));
  }

  async pushJsonPayload(data) {
    if (this._dryRun) {
      console.log('DRY-RUN: not pushing.');
      return;
    }

    await this.getLargeFileContainer();
    await this.uploadFileToAws(this.uploadUri, data);
    await this.sendBatchRequest();
  }

  async sendBatchRequest(fileId = this.fileId) {
    return this._sendRequest('PUT', `documents/batch?fileId=${encodeURIComponent(fileId)}`);
  }
}
