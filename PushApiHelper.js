'use strict';

const request = require('request');

class PushApiHelper {

  constructor() {
    this._dir = process.cwd();
    try {
      this.config = require(`${this._dir}/.pushapi-config`);
    }
    catch (e) {
      PushApiHelper.throwError(`Couldn't load .pushapi-config.json file from ${this._dir}`);
    }

    this.validateConfig();
    this._debug('\nconfig = ', this.config);
  }

  _debug () {
    if (this.config.debug) {
      console.debug.apply(console, arguments);
    }
  }

  _log () {
    console.log.apply(console, arguments);
  }

  _sendRequest (method, action) {
    let config = this.config,
      url = /^http/.test(action) ? action : `https://${config.platform}/v1/organizations/${config.org}/sources/${config.source}/${action}`;

    return new Promise((resolve, reject) => {
      request({
        method: method,
        url: url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + config.apiKey
        }
      },
        (err, httpResponse, body) => {
          this._debug('\nREQUEST: ', method, url, httpResponse && httpResponse.statusCode, err);
          if (!err && [200, 201, 202].includes(httpResponse.statusCode)) {
            resolve(body);
          }
          else {
            console.log('ERROR: ', err, httpResponse.statusCode, url);
            reject(err || httpResponse.statusCode);
          }
        });
    });
  }

  changeStatus (state) {
    return this._sendRequest(`POST`, `status?statusType=${state}`);
  }

  getLargeFileContainer () {
    let config = this.config;
    return this._sendRequest(`POST`, `https://${config.platform}/v1/organizations/${config.org}/files`).then(
      body => {
        let resp = JSON.parse(body);

        this.uploadUri = resp.uploadUri;
        this.fileId = resp.fileId;

        this._debug('uploadUri: ', resp.uploadUri);
        this._log('fileId: ', resp.fileId);

        return resp;
      }
    );
  }

  sendBatchRequest (fileId) {
    return this._sendRequest(`PUT`, `documents/batch?fileId=${fileId || this.fileId}`);
  }

  uploadBatchFile (data) {
    return new Promise((resolve, reject) => {

      request.put({
        url: this.uploadUri,
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-amz-server-side-encryption': 'AES256'
        },
        body: JSON.stringify(data)
      },
        (err, httpResponse, body) => {
          if (!err && [200, 201, 202].includes(httpResponse.statusCode)) {
            this._debug('Batch file sent to AWS. ', new Date().toLocaleTimeString('en-US', { hour12: false }));
            this._log(body);
            resolve(body);
          }
          else {
            console.log('ERROR: ', err, httpResponse.statusCode, this.uploadUri);
            reject(err);
          }
        });
    });
  }

  pushFile (data) {
    // validate payload first
    if (!data) {
      console.warn('Invalid payload: not defined.');
    }
    if (data instanceof Array) {
      data = { AddOrUpdate: data }; // need to wrap arrays of documents into AddOrUpdate
    }
    if (!data.AddOrUpdate) {
      // wrap payload into {"AddOrUpdate": [data]}
      data = {
        AddOrUpdate: [
          data
        ]
      };
    }
    let fileExtensionWarning = false;
    // validate each document has a DocumentId
    data.AddOrUpdate.forEach(d => {
      let keys = Object.keys(d).map(k => k.toLowerCase());
      if (!keys.includes('documentid')) {
        console.warn(`Missing DocumentId in some documents in the payload. Stopping.`);
        throw new Error('No DocumentId.');
      }
      if (!fileExtensionWarning && !keys.includes('fileextension')) {
        console.log(`Missing FileExtension in some documents. It's good practice to provide them.`);
        fileExtensionWarning = true;
      }
    });

    // push it
    return this.changeStatus('REBUILD')
      .then(this.getLargeFileContainer.bind(this))
      .then(this.uploadBatchFile.bind(this, data))
      .then(this.sendBatchRequest.bind(this))
      .then(this.changeStatus.bind(this, 'IDLE'))
      .catch((err) => {
        console.log(err);
      });
  }

  static throwError (msg, code) {
    console.warn(`\n\t${msg}`);
    process.exit(code || 1);
  }

  validateConfig () {
    if (!this.config) {
      PushApiHelper.throwError('Missing config (.pushapi-config.json)', 2);
    }
    if (!this.config.platform) {
      this.config.platform = 'push.cloud.coveo.com';
    }

    if (!this.config.apiKey || this.config.apiKey === 'xx--your-api-key--abc') {
      PushApiHelper.throwError('Missing apiKey in .pushapi-config.json', 3);
    }
    if (!this.config.org || this.config.org === 'your-org-id') {
      PushApiHelper.throwError('Missing org in .pushapi-config.json', 4);
    }
    if (!this.config.source || this.config.source === 'your-source-id') {
      PushApiHelper.throwError('Missing source in .pushapi-config.json', 5);
    }
  }
}

module.exports = PushApiHelper;
