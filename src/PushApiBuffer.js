/* eslint-disable no-console */
const fs = require('fs');
const PushApiHelper = require('./PushApiHelper');

const MAX_BUFFER_SIZE = 256000000; // 256 MB is max for Push payloads.

class PushApiBuffer {
  constructor(dryRun = false) {
    this._dryRun = dryRun;
    this.buffer = [];
    this.bufferSize = 0;
    this.bufferCount = 1;
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

        let payload = await this.loadFile(pathToJson);

        if (payload instanceof Array) {
          const len = payload.length;
          for (let i = 0; i < len; i++) {
            this.buffer.push(payload[i]);
          }
          // this.buffer.push(...payload); // This fails for large files
        } else {
          this.buffer.push(payload);
        }
      } catch (e) {
        console.log(e);
      }
    }
  }

  getPushApiHelper() {
    if (!this._pushapihelper) {
      this._pushapihelper = new PushApiHelper();
    }
    return this._pushapihelper;
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

        this.getPushApiHelper()
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

module.exports = PushApiBuffer;
