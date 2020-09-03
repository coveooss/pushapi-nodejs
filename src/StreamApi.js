'use strict';

const PlatformRequestsHelper = require('./PlatformRequestsHelper');

class StreamApi extends PlatformRequestsHelper {

  async openStream() {
    let config = this.config;
    return this._sendRequest(`POST`, `https://api.cloud.coveo.com/push/v1/organizations/${config.org}/sources/${config.source}/stream/open`).then(
      body => {
        console.log('\nOpen stream to source: \x1b[33m \x1b[1m', this.config.source, '\x1b[0m', this._now());
        const resp = (typeof body === 'string') ? JSON.parse(body) : body;

        this._debug('uploadUri: ', resp.uploadUri);
        this._log('streamId: ', resp.streamId);

        return resp;
      }
    );
  }

  async closeStream(streamInfo) {
    let config = this.config;
    return this._sendRequest(`POST`, `https://api.cloud.coveo.com/push/v1/organizations/${config.org}/sources/${config.source}/stream/${streamInfo.streamId}/close`).then(
      body => {
        console.log('Close stream.', this._now(), '\n');
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

}

module.exports = StreamApi;
