import { readFile, stat, writeFile } from 'node:fs/promises';

import { CliError } from './errors.js';
import { normalizePayloadItems } from './payload.js';

export const MAX_BUFFER_SIZE = 256_000_000; // 256 MB is max for Push payloads.
export const BUFFER_FILE_PREFIX = '.pushapi.buffer.';

/**
 * Reads and parses a JSON file, with a helpful error message when the JSON is invalid.
 * @param {string} pathToJson
 */
export async function loadJsonFile(pathToJson) {
  const data = await readFile(pathToJson, 'utf8');
  try {
    return JSON.parse(data);
  } catch (cause) {
    throw new CliError(`Invalid JSON in ${pathToJson}: ${cause.message}`, { cause });
  }
}

/**
 * Accumulates the items of many JSON files, and sends them in batches of at most MAX_BUFFER_SIZE bytes.
 */
export default class JsonBuffer {
  constructor(apiHelper, config, dryRun = false) {
    this._dryRun = dryRun;
    this.apiHelper = apiHelper;
    this.config = config;
    this.buffer = [];
    this.bufferSize = 0;
    this.bufferCount = 1;
    this.totalItemCount = 0;
  }

  _debug(...args) {
    if (this.config.debug) {
      console.debug(...args);
    }
  }

  normalizePayloadItems(payload, pathToJson) {
    return normalizePayloadItems(payload, pathToJson);
  }

  async addJsonFile(pathToJson) {
    const { size: fileSize } = await stat(pathToJson);

    if (fileSize > MAX_BUFFER_SIZE) {
      console.warn('\n File is bigger than maximum size. You need to break it up.\nSkipping this file: ', pathToJson);
      return;
    }

    if (this.bufferSize + fileSize > MAX_BUFFER_SIZE) {
      console.log('\n ------ BATCH ------ \n', this.bufferSize);
      await this.sendBuffer();
    }

    this._debug('Loading file: ', pathToJson);
    const payload = await loadJsonFile(pathToJson);
    const items = this.normalizePayloadItems(payload, pathToJson);
    this.bufferSize += fileSize;
    this.totalItemCount += items.length;

    // `this.buffer.push(...items)` overflows the call stack for large files.
    for (const item of items) {
      this.buffer.push(item);
    }
  }

  async sendBuffer() {
    if (this.bufferSize <= 0) {
      return;
    }

    const bufferName = `${BUFFER_FILE_PREFIX}${this.bufferCount}`;
    const payload = { AddOrUpdate: this.buffer };

    if (this._dryRun) {
      console.log('Created buffer file (not pushing): ', bufferName);
      await writeFile(bufferName, JSON.stringify(payload));
    } else {
      this._debug('Buffer full, sending ', bufferName);
      await this.apiHelper.pushJsonPayload(payload);
      console.log('UPLOAD done ', bufferName);
    }

    this.buffer = [];
    this.bufferSize = 0;
    this.bufferCount++;
  }
}
