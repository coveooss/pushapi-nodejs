const fs = require('fs');

const MAX_BUFFER_SIZE = 256000000; // 256 MB is max for Push payloads.

class JsonBuffer {
  constructor(config, dryRun = false) {
    this._dryRun = dryRun;
    this.buffer = [];
    this.bufferSize = 0;
    this.bufferCount = 1;
    this.config = config;
  }

  _debug() {
    if (this.config.debug) {
      console.debug.apply(console, arguments);
    }
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
      try {
        this.bufferSize += fileSize;

        this._debug('Loading file: ', pathToJson);
        let payload = await this.loadFile(pathToJson);

        if (payload instanceof Array) {
          const len = payload.length;
          // Need to use for(){} here,
          // because this.buffer.push(...payload); fails for large files
          for (let i = 0; i < len; i++) {
            this.buffer.push(payload[i]);
          }
        } else {
          this.buffer.push(payload);
        }
      } catch (e) {
        console.log(e);
      }
    }
  }

  getPushApi() {
    if (!this._pushapi) {
      const PushApi = require('./PushApi');
      this._pushapi = new PushApi(this.config);
    }
    return this._pushapi;
  }

  async loadFile(pathToJson) {
    return new Promise(resolve => {
      fs.readFile(pathToJson, (err, data) => {
        resolve(JSON.parse(data));
      });
    });
  }

  async sendBuffer() {
    return new Promise((resolve) => {

      if (this.bufferSize <= 0) {
        resolve();
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

        resolve();

      } else {

        this.getPushApi()
          .pushJsonPayload({
            AddOrUpdate: this.buffer
          })
          .then(() => {
            console.log('UPLOAD done ', bufferName);
            this.buffer = [];
            this.bufferSize = 0;
            this.bufferCount++;
            resolve();
          });

      }
    });
  }
}

module.exports = JsonBuffer;
