/* eslint-disable no-console */
const fs = require('fs');
const bigjson = require('big-json');
const PushApiHelper = require('./PushApi');

const MAX_BUFFER_SIZE = 250 * 1024 * 1024; // 256 MB is max for Push payloads, using 250 to keep it safe.

class PushApiBuffer {
  constructor() {
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
    } else if (fileSize + this.bufferSize > MAX_BUFFER_SIZE) {
      console.log('\n ------ BATCH ------ \n', this.bufferSize);
      await this.sendBuffer();
      await this.addJsonFile(pathToJson);
    } else {
      try {
        this.bufferSize += fileSize;

        let payload = await this.loadFile(pathToJson);

        if (payload instanceof Array) {
          this.buffer.push(...payload);
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

      const bufferName = `.buffer.${this.bufferCount}`;

      const fout = fs.createWriteStream(bufferName);
      const stringifyStream = bigjson.createStringifyStream({
        body: {
          AddOrUpdate: this.buffer
        }
      });

      stringifyStream.pipe(fout);

      stringifyStream.on('end', () => {
        console.log('write done on ', bufferName);
        fout.close();

        this.getPushApiHelper().pushFileBuffer(bufferName).then(() => {
          console.log('UPLOAD done on ', bufferName);

          fs.unlinkSync(bufferName);
          this.buffer = [];
          this.bufferSize = 0;
          this.bufferCount++;
          resolve();
        });
      });

    });
  }
}

module.exports = PushApiBuffer;