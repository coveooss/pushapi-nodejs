'use strict';

import PlatformRequestsHelper from './PlatformRequestsHelper';

class StreamApi extends PlatformRequestsHelper {

  async openStream() {
    let config = this.config;
    return this._sendRequest(`POST`, `https://api.cloud.coveo.com/push/v1/organizations/${config.org}/sources/${config.source}/stream/open`).then(
      body => {
        console.log('openStream', typeof body);
        const resp = (typeof body === 'string') ? JSON.parse(body) : body;
        console.log('openStream', resp);

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
        console.log('closeStream', typeof body);
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

export default StreamApi;
