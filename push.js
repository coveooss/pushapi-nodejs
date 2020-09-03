const fs = require('fs');
const JsonBuffer = require('./src/JsonBuffer');
const PushApi = require('./src/PushApi');
const StreamApi = require('./src/StreamApi');
const SourceConfig = require('./src/SourceConfig');


const argv = require('yargs')
  .usage('\nUsage: $0 <File_or_Folder> [options]')
  .example('$0 file1.json', 'Upload a single file to a Push Source')
  .example('$0 folder2', 'Upload all .json files from a folder to a Push Source')
  .example('$0 folder3 -d 2', 'Sends a deleteOlderThan 2 hours before pushing new data')
  .alias('d', 'deleteOlderThan')
  .default('d', null)
  .describe('d', 'Set the deleteOlderThan delay (in hours)')
  .alias('D', 'dry-run')
  .boolean('D')
  .describe('D', 'Dry run - creates the batch files, without pushing them')
  .demandCommand(1, 'You need to specify a FILE or a FOLDER')
  .help()
  .argv;

const FILE_OR_FOLDER = argv._[0];

function pushFile(sourceConfig, file) {
  console.log(`Loading file: ${file}`);
  if (argv['dry-run']) {
    console.log('DRY-RUN, not pushing.');
    return;
  }
  fs.readFile(file, async (err, data) => {
    if (!err) {
      try {
        const payload = JSON.parse(data);
        if (sourceConfig.useStreamApi) {
          const streamHelper = new StreamApi(sourceConfig);
          await streamHelper.pushFile(payload);
        } else {
          console.log(`\nPushing one file to source: \x1b[33m\x1b[1m${sourceConfig.source}\x1b[0m`);
          const pushApiHelper = new PushApi(sourceConfig);
          await pushApiHelper.changeStatus('REBUILD');
          await pushApiHelper.pushFile(payload);
          await pushApiHelper.changeStatus('IDLE');
        }
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

async function main() {
  try {
    const dryRun = argv['dry-run'] ? true : false;

    const sourceConfig = new SourceConfig();
    const pushApiHelper = new PushApi(sourceConfig, dryRun);

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

      if (sourceConfig.useStreamApi) {
        console.warn(`Can't use stream on a folder, use a file.`);
        return;
      }

      let _dir = process.cwd();
      let folderName = FILE_OR_FOLDER;

      // process every .json files in the folder as separate batch requests.
      console.log(`Loading folder: ${_dir}/${folderName}`);

      console.log('\nUpdate status for source: \x1b[33m \x1b[1m', sourceConfig.source, '\x1b[0m');
      await pushApiHelper.changeStatus('REBUILD');

      let pushApiBuffer = new JsonBuffer(dryRun);
      let files = fs.readdirSync(`${_dir}/${folderName}`);

      // consider only .json files
      files = files.filter(fileName => (/\.json$/.test(fileName)));
      for (let fileName of files) {
        await pushApiBuffer.addJsonFile(`${_dir}/${folderName}/${fileName}`);
      }
      await pushApiBuffer.sendBuffer();

      await pushApiHelper.changeStatus('IDLE');

    } else if (stats.isFile()) {
      pushFile(sourceConfig, FILE_OR_FOLDER);
    } else {
      argv.help();
    }

    console.log(`\nDone\n\n`);

  } catch (e) {
    PushApi.throwError(e, 10);
  }
}


let configFile = `${process.cwd()}/.pushapi-config.json`;
if (!fs.existsSync(configFile)) {
  console.warn(`\n\tCouldn't load ${configFile} file`);
  SourceConfig.createConfig(configFile, main);
} else {
  return main();
}
