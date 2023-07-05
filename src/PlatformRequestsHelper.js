'use strict';
const https = require('https');

class PlatformRequestsHelper {

  constructor(config, dryRun = false) {
    this._dryRun = dryRun;
    this.config = config;

    this._debug('\nconfig = ', this.config);
  }

  _debug() {
    if (this.config.debug) {
      console.debug.apply(console, arguments);
    }
  }

  _log() {
    console.log.apply(console, arguments);
  }

  _now() {
    let time = new Date().toLocaleTimeString('en-US', {
      hour12: false
    });
    return `\x1b[94m ${time} \x1b[0m`;
  }

  /**
   * Utility function to check if a key in a JSON object. The JSON payload for the Push Api is case-insensitive, so DocumentId is the same as documentid.
   * @param {string} key
   * @param {Object} obj
   */
  _isKeyMissingInObject(key, obj) {
    const keys = Object.keys(obj).map(k => k.toLowerCase());
    return !(keys.includes(key.toLowerCase()));
  }

  async _sendRequest(method, action) {

    this._debug('_sendRequest::', method, action);

    const config = this.config;
    let path = `/v1/organizations/${config.org}/sources/${config.source}/${action}`;

    if (/^http/.test(action)) {
      path = action.split('://')[1].replace(/^[^/]*\/?/, '/');
    }

    if (this._dryRun) {
      console.log('DRY-RUN: skip ');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const options = {
        method: method,
        hostname: config.platform,
        path,
        port: 443,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
      };

      const req = https.request(options,
        (resp) => {
          this._debug('statusCode:', resp.statusCode);
          this._debug('headers:', resp.headers);

          let data = "";
          resp.on("data", chunk => {
            data += chunk;
          });
          resp.on("end", () => {
            this._debug('\nREQUEST: ', method, resp.statusCode, data);
            if (resp.statusCode >= 400) {
              reject(resp);
            } else {
              resolve(data);
            }
          });
        });
      req.on('error', (err) => {
        console.log('ERROR: ', err);
        reject(err);
      });
      req.end();
    });
  }

  async uploadFileToAws(uploadUri, body) {
    const url = new URL(uploadUri);
    const path = uploadUri.split('://')[1].replace(/^[^/]*\/?/, '/');

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(body);
      const options = {
        method: 'PUT',
        hostname: url.hostname,
        path,
        port: 443,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': postData.length,
          'x-amz-server-side-encryption': 'AES256'
        },
        maxContentLength: 256000000, // 256 MB
        maxBodyLength: 256000000,
        json: true,
      };
      this._debug('\n\nuploadFileToAws:\n', options);

      const req = https.request(options, (response) => {
        console.log('File uploaded to AWS. ', this._now());
        this._debug(response.statusCode, response.statusMessage);
        resolve(response);
      });

      req.on('error', (error) => {
        console.log('ERROR 1: ', error, uploadUri);
        reject(error);
      });
      req.write(postData);
      req.end();
    });
  }

  validatePayload(data) {
    // validate payload first
    if (!data) {
      console.warn('Invalid payload: not defined.');
    }
    if (data instanceof Array) {
      data = {
        AddOrUpdate: data
      }; // need to wrap arrays of documents into AddOrUpdate
    }

    if (this._isKeyMissingInObject('AddOrUpdate', data)) {
      // wrap payload into {"AddOrUpdate": [data]}
      data = {
        AddOrUpdate: [
          data
        ]
      };
    } else if (!data.AddOrUpdate) {
      // AddOrUpdate is present, but using a different case.

      // find the key using the different case
      let key = Object.keys(data).filter(k => k.match(/AddOrUpdate/i))[0];

      // replacing key by 'AddOrUpdate'
      data.AddOrUpdate = data[key];
      delete data[key];
    }

    let fileExtensionWarning = false;
    // validate each document has a DocumentId
    data.AddOrUpdate.forEach(d => {
      if (this._isKeyMissingInObject('DocumentId', d)) {
        console.warn(`Missing DocumentId in some documents in the payload. Stopping.`);
        throw new Error('No DocumentId.');
      }
      if (!fileExtensionWarning && this._isKeyMissingInObject('FileExtension', d)) {
        console.log(`Missing FileExtension in some documents. It's good practice to provide them.`);
        fileExtensionWarning = true;
      }
    });

    return data;
  }

  static throwError(msg, code) {
    console.warn(`\n\t${msg}`);
    process.exit(code || 1);
  }
}

module.exports = PlatformRequestsHelper;
