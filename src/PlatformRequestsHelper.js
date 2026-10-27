import { styleText } from 'node:util';

import { HttpError } from './errors.js';
import { validatePayload } from './payload.js';

export default class PlatformRequestsHelper {
  constructor(config, dryRun = false) {
    this._dryRun = dryRun;
    this.config = config;

    this._debug('\nconfig = ', { ...config, apiKey: '***' });
  }

  _debug(...args) {
    if (this.config.debug) {
      console.debug(...args);
    }
  }

  _log(...args) {
    console.log(...args);
  }

  _now() {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    return styleText('blueBright', ` ${time} `);
  }

  _highlight(text) {
    return styleText(['yellow', 'bold'], String(text));
  }

  /**
   * Builds the URL for a Push API action.
   * `action` is either a path relative to the source (e.g. `status?statusType=IDLE`) or an absolute URL.
   */
  _buildUrl(action) {
    if (/^https?:\/\//.test(action)) {
      return new URL(action);
    }
    const { platform, org, source } = this.config;
    return new URL(`https://${platform}/v1/organizations/${org}/sources/${source}/${action}`);
  }

  async _sendRequest(method, action, body) {
    this._debug('_sendRequest::', method, action);

    const url = this._buildUrl(action);
    const context = `${method} ${url.host}${url.pathname}`;

    if (this._dryRun) {
      console.log('DRY-RUN: skip ', context);
      return undefined;
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data = await response.text();
    this._debug('\nREQUEST: ', method, response.status, data);

    if (!response.ok) {
      throw new HttpError(context, response, data);
    }
    return data;
  }

  async _sendJsonRequest(method, action, body) {
    const data = await this._sendRequest(method, action, body);
    return data ? JSON.parse(data) : data;
  }

  async uploadFileToAws(uploadUri, body) {
    const url = new URL(uploadUri);
    const postData = JSON.stringify(body);
    this._debug('\n\nuploadFileToAws:\n', `PUT ${url.host}${url.pathname}`, `${Buffer.byteLength(postData)} bytes`);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-amz-server-side-encryption': 'AES256',
      },
      body: postData,
    });

    const data = await response.text();
    this._debug(response.status, response.statusText);

    if (!response.ok) {
      throw new HttpError(`PUT ${url.host}${url.pathname}`, response, data);
    }
    console.log('File uploaded to AWS. ', this._now());
    return response;
  }

  validatePayload(data) {
    return validatePayload(data);
  }
}
