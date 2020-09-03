import fs from 'fs';
import JsonBuffer from './src/JsonBuffer';
import PushApi from './src/PushApi';
import StreamApi from './src/StreamApi';


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
  .alias('S', 'stream')
  .boolean('S')
  .describe('S', 'Stream - uses the Stream api to populate a Catalog Source')
  .demandCommand(1, 'You need to specify a FILE or a FOLDER')
  .help()
  .argv;

const FILE_OR_FOLDER = argv._[0];

function pushFile(file) {
  console.log(`Loading file: ${file}`);
  if (argv['dry-run']) {
    console.log('DRY-RUN, not pushing.');
    return;
  }
  fs.readFile(file, async (err, data) => {
    if (!err) {
      try {
        const payload = JSON.parse(data);
        if (argv.stream) {
          const streamHelper = new StreamApi();
          await streamHelper.pushFile(payload);
        } else {
          const pushApiHelper = new PushApi();
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
    const usingStream = argv.stream ? true : false;
    const pushApiHelper = new PushApi(dryRun);

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

      if (usingStream) {
        console.warn(`Can't use stream on a folder, use a file.`);
        return;
      }

      let _dir = process.cwd();
      let folderName = FILE_OR_FOLDER;

      // process every .json files in the folder as separate batch requests.
      console.log(`Loading folder: ${_dir}/${folderName}`);

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
      pushFile(FILE_OR_FOLDER);
    } else {
      argv.help();
    }

  } catch (e) {
    PushApi.throwError(e, 10);
  }
}


let configFile = `${process.cwd()}/.pushapi-config.json`;
if (!fs.existsSync(configFile)) {
  console.warn(`\n\tCouldn't load ${configFile} file`);

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('\nWould you like to create the config file now? [Y/n] ', (answer) => {
    if (!answer || (/^y(es)?$/i).test(answer)) {
      rl.question('Source ID: ', source => {
        source = (source || '').trim();
        const orgFromSourceId = source.split('-')[0];
        rl.question(`Org ID: [${orgFromSourceId}]`, org => {
          org = (org || '').trim();
          if (!org && orgFromSourceId) {
            org = orgFromSourceId;
          }
          rl.question('API key: ', apiKey => {
            rl.close();
            apiKey = (apiKey || '').trim();

            console.log('creating file:  ', configFile);
            let payload = {
              org,
              source,
              apiKey
            };
            fs.writeFileSync(
              configFile,
              JSON.stringify(payload, 2, 2)
            );

            // eslint-disable-next-line no-octal
            fs.chmodSync(configFile, 0600);

            main();
          });
        });
      });
    } else {
      rl.close();
      process.exit();
    }
  });
} else {
  return main();
}
