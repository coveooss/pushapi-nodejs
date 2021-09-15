const fs = require('fs');

const Config = require('./src/Config');
const JsonBuffer = require('./src/JsonBuffer');
const PushApi = require('./src/PushApi');
const StreamApi = require('./src/StreamApi');


function pushFile(config, file, dryRun = false) {
  console.log(`Loading file: ${file}`);
  if (dryRun) {
    console.log('DRY-RUN, not pushing.');
    return;
  }
  fs.readFile(file, async (err, data) => {
    if (!err) {
      try {
        const payload = JSON.parse(data);

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
          await pushApiHelper.changeStatus('REBUILD');
          await pushApiHelper.pushFile(payload);
          await pushApiHelper.changeStatus('IDLE');
        }
        console.log(`\nDone\n`);
      } catch (e) {
        console.warn('Invalid payload.');
        console.warn(e);
        return;
      }
    } else {
      console.log(`\nCouldn't read file "${file}": \n\t`, err);
    }
  });
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
      if (!config.useStreamApi) await pushApiHelper.changeStatus('REBUILD');

      let apiHelper = null;
      try {
        if (config.useStreamApi) {
          apiHelper = new StreamApi(config);
          await apiHelper.openStream();
        }
        else {
          apiHelper = new PushApi(config);
        }
      }
      catch (err) {
        console.error(err.statusCode, err.statusMessage, (err.req && err.req.path || ''));
        console.error(err.body || err);
      }

      let pushApiBuffer = new JsonBuffer(apiHelper, config, dryRun);
      let files = fs.readdirSync(`${_dir}/${folderName}`);

      // consider only .json files
      files = files.filter(fileName => (/\.json$/.test(fileName)));
      for (let fileName of files) {
        await pushApiBuffer.addJsonFile(`${_dir}/${folderName}/${fileName}`);
      }
      await pushApiBuffer.sendBuffer();

      if (config.useStreamApi) {
        try {
          await apiHelper.closeStream();
        }
        catch (err) {
          console.error(err.statusCode, err.statusMessage, (err.req && err.req.path || ''));
          console.error(err.body || err);
        }
      }

      if (!config.useStreamApi) await pushApiHelper.changeStatus('IDLE');

      console.log(`\nDone\n`);

    } else if (stats.isFile()) {
      pushFile(config, FILE_OR_FOLDER, argv['dry-run'] ? true : false);
    } else if (argv.help) {
      argv.help();
    }

  } catch (e) {
    PushApi.throwError(e, 10);
  }
}


exports.main = main;
exports.Config = Config;
exports.PushApi = PushApi;
exports.StreamApi = StreamApi;
