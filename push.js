const fs = require('fs');

const Config = require('./src/Config');
const JsonBuffer = require('./src/JsonBuffer');
const PushApi = require('./src/PushApi');
const StreamApi = require('./src/StreamApi');


async function runWithSourceInRebuild(pushApiHelper, work) {
  let statusChanged = false;
  let result;
  let workError = null;

  await pushApiHelper.changeStatus('REBUILD');
  statusChanged = true;

  try {
    result = await work();
  } catch (error) {
    workError = error;
  }

  if (statusChanged) {
    try {
      await pushApiHelper.changeStatus('IDLE');
    } catch (statusError) {
      if (workError) {
        statusError.cause = workError;
      }
      throw statusError;
    }
  }

  if (workError) {
    throw workError;
  }

  return result;
}

function reportError(error) {
  if (error && error.statusCode) {
    console.error(error.message);
    if (error.body) {
      console.error(error.body);
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

  let payload;
  try {
    payload = JSON.parse(await fs.promises.readFile(file, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) {
      error.message = `Invalid JSON in ${file}: ${error.message}`;
    }
    throw error;
  }

  // quick validation of the payload
  if (!payload || (!(payload instanceof Array) && !payload.AddOrUpdate && !payload.addOrUpdate)) {
    console.warn(`\n\t !! Your payload seems to be in a wrong format !!\n\n\tMissing \x1b[33m\x1b[1m{ "AddOrUpdate": [] }\x1b[0m around your data?\n\n`);
  }

  if (config.useStreamApi) {
    const streamHelper = new StreamApi(config);
    await streamHelper.pushFile(payload);
  } else {
    console.log(`\nPushing one file to source: \x1b[33m\x1b[1m${config.source}\x1b[0m`);
    const pushApiHelper = new PushApi(config);
    await runWithSourceInRebuild(pushApiHelper, () => pushApiHelper.pushFile(payload));
  }

  console.log(`\nDone\n`);
}

function deleteBuffers() {
  let buffers = fs.readdirSync('.').filter(fileName => fileName.startsWith('.pushapi.buffer.'));
  buffers.forEach(fileName => {
    console.log('deleting buffer: ', fileName);
    fs.unlinkSync(fileName);
  });
  console.log('');
}

async function main(FILE_OR_FOLDER, argv = { deleteOlderThan: null }) {

  try {
    const dryRun = argv['dry-run'] ? true : false;

    const config = new Config();
    const pushApiHelper = new PushApi(config, dryRun);

    if (argv.deleteOlderThan !== null) {
      const orderingId = Date.now() - (argv.deleteOlderThan * 60 * 60 * 1000) - 1;
      console.log(`Deleting items older than ${argv.deleteOlderThan} hours (${orderingId}).`);
      await pushApiHelper.deleteOlderThan(orderingId);
    }

    if (dryRun) {
      deleteBuffers();
    }

    let stats = fs.statSync(FILE_OR_FOLDER);
    if (stats.isDirectory()) {

      let _dir = process.cwd();
      let folderName = FILE_OR_FOLDER;

      // process every .json files in the folder as separate batch requests.
      console.log(`Loading folder: ${_dir}/${folderName}`);

      console.log('\nUpdate status for source: \x1b[33m \x1b[1m', config.source, '\x1b[0m');
      const pushFolder = async () => {
        let apiHelper = null;
        if (config.useStreamApi) {
          apiHelper = new StreamApi(config);
          await apiHelper.openStream();
        }
        else {
          apiHelper = new PushApi(config);
        }

        try {
          let pushApiBuffer = new JsonBuffer(apiHelper, config, dryRun);
          let files = fs.readdirSync(`${_dir}/${folderName}`);

          // consider only .json files
          files = files.filter(fileName => (/\.json$/.test(fileName)));
          for (let fileName of files) {
            await pushApiBuffer.addJsonFile(`${_dir}/${folderName}/${fileName}`);
          }
          await pushApiBuffer.sendBuffer();
        } finally {
          if (config.useStreamApi && apiHelper) {
            await apiHelper.closeStream();
          }
        }
      };

      if (config.useStreamApi) {
        await pushFolder();
      } else {
        await runWithSourceInRebuild(pushApiHelper, pushFolder);
      }

      console.log(`\nDone\n`);

    } else if (stats.isFile()) {
      await pushFile(config, FILE_OR_FOLDER, argv['dry-run'] ? true : false);
    } else if (argv.help) {
      argv.help();
    }

  } catch (e) {
    reportError(e);
    process.exit(10);
  }
}


exports.main = main;
exports.Config = Config;
exports.PushApi = PushApi;
exports.StreamApi = StreamApi;
