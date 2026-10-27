import PlatformRequestsHelper from './PlatformRequestsHelper.js';

export default class StreamApi extends PlatformRequestsHelper {
  getApiEndpoint() {
    return this.config.platform.replace(/^push/, 'api');
  }

  _streamUrl(suffix) {
    const { org, source } = this.config;
    return `https://${this.getApiEndpoint()}/push/v1/organizations/${org}/sources/${source}/stream/${suffix}`;
  }

  async openStream() {
    const resp = await this._sendJsonRequest('POST', this._streamUrl('open'));
    console.log(`\nOpen stream to source: ${this._highlight(this.config.source)}`, this._now());

    this._debug('uploadUri: ', resp.uploadUri);
    this._log('streamId: ', resp.streamId);

    this._last_uploadUri = resp.uploadUri;
    this._last_streamId = resp.streamId;

    return resp;
  }

  async getChunk() {
    const resp = await this._sendJsonRequest('POST', this._streamUrl(`${this._last_streamId}/chunk`));
    console.log(`\nGet chunk for stream: ${this._highlight(this.config.source)}`, this._now());

    this._debug('uploadUri: ', resp.uploadUri);
    return resp;
  }

  async closeStream() {
    const resp = await this._sendJsonRequest('POST', this._streamUrl(`${this._last_streamId}/close`));
    console.log('Close stream.', this._now());
    return resp;
  }

  async pushFile(data) {
    data = this.validatePayload(data);

    const streamInfo = await this.openStream();
    try {
      await this.uploadFileToAws(streamInfo.uploadUri, data);
    } finally {
      await this.closeStream();
    }
  }

  async pushJsonPayload(data) {
    if (this._dryRun) {
      console.log('DRY-RUN: not pushing.');
      return;
    }

    let uploadUri = this._last_uploadUri;
    if (!uploadUri) {
      const chunkResponse = await this.getChunk();
      this._debug('chunkResponse: ', chunkResponse);
      uploadUri = chunkResponse.uploadUri;
    }
    await this.uploadFileToAws(uploadUri, data);
    this._last_uploadUri = null;
  }
}
