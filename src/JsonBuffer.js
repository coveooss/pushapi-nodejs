const fs = require('fs');

const MAX_BUFFER_SIZE = 256000000; // 256 MB is max for Push payloads.

class JsonBuffer {
  constructor(apiHelper, config, dryRun = false) {
    this._dryRun = dryRun;
    this.apiHelper = apiHelper;
    this.buffer = [];
    this.bufferSize = 0;
    this.bufferCount = 1;
    this.totalItemCount = 0;
    this.config = config;
  }

  _debug() {
    if (this.config.debug) {
      console.debug.apply(console, arguments);
    }
  }

  normalizePayloadItems(payload, pathToJson) {
    if (payload instanceof Array) {
      return payload;
    }

    if (payload && typeof payload === 'object') {
      const addOrUpdateKey = Object.keys(payload).find(key => key.toLowerCase() === 'addorupdate');
      if (addOrUpdateKey) {
        if (!(payload[addOrUpdateKey] instanceof Array)) {
          throw new Error(`Invalid payload in ${pathToJson}: AddOrUpdate must be an array.`);
        }
        return payload[addOrUpdateKey];
      }
    }

    return [payload];
  }

  async addJsonFile(pathToJson) {
    // add to Buffer
    let {
      size: fileSize
    } = fs.statSync(pathToJson);

    if (fileSize > MAX_BUFFER_SIZE) {
      console.warn('\n File is bigger than maximum size. You need to break it up.\nSkipping this file: ', pathToJson);
    } else if ((this.bufferSize + fileSize) > MAX_BUFFER_SIZE) {
      console.log('\n ------ BATCH ------ \n', this.bufferSize);
      await this.sendBuffer();
      await this.addJsonFile(pathToJson);
    } else {
      this._debug('Loading file: ', pathToJson);
      let payload = await this.loadFile(pathToJson);
      const items = this.normalizePayloadItems(payload, pathToJson);
      this.bufferSize += fileSize;

      const len = items.length;
      this.totalItemCount += len;
      // Need to use for(){} here,
      // because this.buffer.push(...items); fails for large files
      for (let i = 0; i < len; i++) {
        this.buffer.push(items[i]);
      }
    }
  }

  async loadFile(pathToJson) {
    return new Promise((resolve, reject) => {
      fs.readFile(pathToJson, 'utf8', (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          error.message = `Invalid JSON in ${pathToJson}: ${error.message}`;
          reject(error);
        }
      });
    });
  }

  async sendBuffer() {
    if (this.bufferSize <= 0) {
      return;
    }

    const bufferName = `.pushapi.buffer.${this.bufferCount}`;
    this._debug('Buffer full, sending ', bufferName);

    if (this._dryRun) {
      console.log(`Created buffer file (not pushing): `, bufferName);
      fs.writeFileSync(bufferName, JSON.stringify({
        AddOrUpdate: this.buffer
      }));

      this.buffer = [];
      this.bufferSize = 0;
      this.bufferCount++;
      return;
    }

    await this.apiHelper.pushJsonPayload({
      AddOrUpdate: this.buffer
    });
    console.log('UPLOAD done ', bufferName);
    this.buffer = [];
    this.bufferSize = 0;
    this.bufferCount++;
  }
}

module.exports = JsonBuffer;
