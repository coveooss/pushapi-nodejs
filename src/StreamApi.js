'use strict';

const PlatformRequestsHelper = require('./PlatformRequestsHelper');

class StreamApi extends PlatformRequestsHelper {

  getApiEndpoint() {
    return this.config.platform.replace(/^push/, 'api');
  }

  async openStream() {
    let config = this.config;
    return this._sendRequest(`POST`, `https://${this.getApiEndpoint()}/push/v1/organizations/${config.org}/sources/${config.source}/stream/open`).then(
      body => {
        console.log('\nOpen stream to source: \x1b[33m \x1b[1m', this.config.source, '\x1b[0m', this._now());
        const resp = (typeof body === 'string') ? JSON.parse(body) : body;

        this._debug('uploadUri: ', resp.uploadUri);
        this._log('streamId: ', resp.streamId);

        this._last_uploadUri = resp.uploadUri;
        this._last_streamId = resp.streamId;

        return resp;
      }
    );
  }

  async getChunk(streamInfo) {
    let config = this.config;
    return this._sendRequest(`POST`, `https://${this.getApiEndpoint()}/push/v1/organizations/${config.org}/sources/${config.source}/stream/${this._last_streamId}/chunk`).then(
      body => {
        console.log('\nGet chunk for stream: \x1b[33m \x1b[1m', this.config.source, '\x1b[0m', this._now());
        const resp = (typeof body === 'string') ? JSON.parse(body) : body;

        this._debug('uploadUri: ', resp.uploadUri);
        return resp;
      }
    );
  }

  async closeStream(streamInfo) {
    let config = this.config;
    return this._sendRequest(`POST`, `https://${this.getApiEndpoint()}/push/v1/organizations/${config.org}/sources/${config.source}/stream/${this._last_streamId}/close`).then(
      body => {
        console.log('Close stream.', this._now());
        let resp = (typeof body === 'string') ? JSON.parse(body) : body;
        return resp;
      }
    );
  }

  async pushFile(data) {
    data = this.validatePayload(data);

    const streamInfo = await this.openStream();
    await this.uploadFileToAws(streamInfo.uploadUri, data);
    await this.closeStream(streamInfo);
  }

  static throwError(msg, code) {
    console.warn(`\n\t${msg}`);
    process.exit(code || 1);
  }

  async pushJsonPayload(data) {
    if (this._dryRun) {
      console.log('DRY-RUN: not pushing.');
      return;
    }

    // push
    try {
      let uploadUri = this._last_uploadUri;
      if (!uploadUri) {
        const chunkResponse = await this.getChunk();
        this._debug('chunkResponse: ', chunkResponse);
        uploadUri = chunkResponse.uploadUri;
      }
      await this.uploadFileToAws(uploadUri, data);
      this._last_uploadUri = null;
    } catch (err) {
      console.error('\n\nStreamApi ERROR: ',);
      console.error(err.statusCode, err.statusMessage);
      console.error(err.body);
      console.error(err);
      console.error('\n\n');
    }
  }

}

module.exports = StreamApi;
