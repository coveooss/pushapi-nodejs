import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { styleText } from 'node:util';

import Config from './src/Config.js';
import { CliError, HttpError } from './src/errors.js';
import JsonBuffer, { BUFFER_FILE_PREFIX, loadJsonFile } from './src/JsonBuffer.js';
import { countPayloadItems, looksLikePushPayload } from './src/payload.js';
import PushApi from './src/PushApi.js';
import StreamApi from './src/StreamApi.js';

const highlight = (text) => styleText(['yellow', 'bold'], String(text));

/**
 * Runs `work()` with the source in REBUILD status, and always puts it back to IDLE afterwards.
 */
async function runWithSourceInRebuild(pushApiHelper, work) {
  await pushApiHelper.changeStatus('REBUILD');

  let result;
  let workError = null;
  try {
    result = await work();
  } catch (error) {
    workError = error;
  }

  try {
    await pushApiHelper.changeStatus('IDLE');
  } catch (statusError) {
    if (workError) {
      statusError.cause = workError;
    }
    throw statusError;
  }

  if (workError) {
    throw workError;
  }
  return result;
}

/**
 * Prints an error to stderr in a readable way.
 * @param {unknown} error
 */
export function reportError(error) {
  if (error instanceof HttpError) {
    console.error(error.message);
    if (error.body) {
      console.error(error.body);
    }
    return;
  }
  if (error instanceof CliError) {
    console.error(`\n\t${error.message}`);
    if (error.cause && process.env.DEBUG) {
      console.error(error.cause);
    }
    return;
  }
  console.error(error);
}

async function pushFile(config, file, dryRun = false) {
  console.log(`Loading file: ${file}`);
  if (dryRun) {
    console.log('DRY-RUN, not pushing.');
    return;
  }

  const payload = await loadJsonFile(file);
  const itemCount = countPayloadItems(payload);

  if (!looksLikePushPayload(payload)) {
    console.warn(`\n\t !! Your payload seems to be in a wrong format !!\n\n\tMissing ${highlight('{ "AddOrUpdate": [] }')} around your data?\n\n`);
  }

  if (config.useStreamApi) {
    const streamHelper = new StreamApi(config);
    await streamHelper.pushFile(payload);
  } else {
    console.log(`\nPushing one file to source: ${highlight(config.source)}`);
    const pushApiHelper = new PushApi(config);
    await runWithSourceInRebuild(pushApiHelper, () => pushApiHelper.pushFile(payload));
  }

  console.log(`Processed items: ${itemCount}`);
  console.log('\nDone\n');
}

async function pushFolder(config, folder, dryRun = false) {
  const folderPath = path.resolve(folder);
  console.log(`Loading folder: ${folderPath}`);

  const useStreamApi = Boolean(config.useStreamApi);
  const apiHelper = useStreamApi ? new StreamApi(config) : new PushApi(config);

  const processFiles = async () => {
    if (useStreamApi && !dryRun) {
      await apiHelper.openStream();
    }
    try {
      const pushApiBuffer = new JsonBuffer(apiHelper, config, dryRun);
      // process every .json file in the folder, batched into as few requests as possible.
      const files = (await readdir(folderPath)).filter((fileName) => fileName.endsWith('.json')).sort();
      for (const fileName of files) {
        await pushApiBuffer.addJsonFile(path.join(folderPath, fileName));
      }
      await pushApiBuffer.sendBuffer();
      console.log(`Processed items: ${pushApiBuffer.totalItemCount}`);
    } finally {
      if (useStreamApi && !dryRun) {
        await apiHelper.closeStream();
      }
    }
  };

  if (useStreamApi || dryRun) {
    await processFiles();
  } else {
    console.log(`\nUpdate status for source: ${highlight(config.source)}`);
    await runWithSourceInRebuild(apiHelper, processFiles);
  }

  console.log('\nDone\n');
}

async function deleteBuffers(dir = process.cwd()) {
  const buffers = (await readdir(dir)).filter((fileName) => fileName.startsWith(BUFFER_FILE_PREFIX));
  for (const fileName of buffers) {
    console.log('deleting buffer: ', fileName);
    await unlink(path.join(dir, fileName));
  }
  console.log('');
}

/**
 * Pushes a JSON payload file, or every .json file of a folder, to the source configured in `.pushapi-config.json`.
 *
 * @param {string} fileOrFolder
 * @param {{ deleteOlderThan?: number | null, dryRun?: boolean }} [options]
 */
export async function main(fileOrFolder, { deleteOlderThan = null, dryRun = false } = {}) {
  const config = await Config.load();
  const pushApiHelper = new PushApi(config, dryRun);

  if (deleteOlderThan !== null && deleteOlderThan !== undefined) {
    const orderingId = Date.now() - deleteOlderThan * 60 * 60 * 1000 - 1;
    console.log(`Deleting items older than ${deleteOlderThan} hours (${orderingId}).`);
    await pushApiHelper.deleteOlderThan(orderingId);
  }

  if (dryRun) {
    await deleteBuffers();
  }

  let stats;
  try {
    stats = await stat(fileOrFolder);
  } catch (cause) {
    throw new CliError(`Couldn't find file or folder: ${fileOrFolder}`, { cause });
  }

  if (stats.isDirectory()) {
    await pushFolder(config, fileOrFolder, dryRun);
  } else if (stats.isFile()) {
    await pushFile(config, fileOrFolder, dryRun);
  } else {
    throw new CliError(`Not a file or a folder: ${fileOrFolder}`);
  }
}

export { Config, PushApi, StreamApi, CliError, HttpError };
