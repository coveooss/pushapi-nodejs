/* eslint-disable no-console */
const fs = require('fs');
const PushApiBuffer = require('./PushApiBuffer');
const PushApiHelper = require('./PushApiHelper');


const argv = require('yargs')
  .usage('\nUsage: $0 <File_or_Folder> [-d 0]')
  .example('$0 file1.json', 'Upload a single file to a Push Source')
  .example('$0 folder2', 'Upload all .json files from a folder to a Push Source')
  .example('$0 folder3 -d 2', 'Sends a deleteOlderThan 2 hours before pushing new data')
  .alias('d', 'deleteOlderThan')
  .default('d', null)
  .demandCommand(1, 'You need to specify a FILE or a FOLDER')
  .help()
  .argv;

const FILE_OR_FOLDER = argv._[0];

function pushFile(file) {
  console.log(`Loading file: ${file}`);
  fs.readFile(file, (err, data) => {
    if (!err) {
      try {
        (new PushApiHelper()).pushFile(JSON.parse(data));
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


async function main() {
  try {

    if (argv.deleteOlderThan !== null) {
      console.log(`Deleting items older than ${argv.deleteOlderThan} hours.`);
      const orderingId = Date.now() - (argv.deleteOlderThan * 60 * 60 * 1000);
      (new PushApiHelper()).deleteOlderThan(orderingId);
    }

    let stats = fs.statSync(FILE_OR_FOLDER);
    if (stats.isDirectory()) {
      let _dir = process.cwd();
      let folderName = FILE_OR_FOLDER;

      // process every .json files in the folder as separate batch requests.
      console.log(`Loading folder: ${_dir}/${folderName}`);

      let pushApiBuffer = new PushApiBuffer();
      let files = fs.readdirSync(`${_dir}/${folderName}`);

      // consider only .json files
      files = files.filter(fileName => (/\.json$/.test(fileName)));
      for (let fileName of files) {
        await pushApiBuffer.addJsonFile(`${_dir}/${folderName}/${fileName}`);
      }
      pushApiBuffer.sendBuffer();

    } else if (stats.isFile()) {
      pushFile(FILE_OR_FOLDER);
    } else {
      argv.help();
    }

  } catch (e) {
    PushApiHelper.throwError(e, 10);
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

  rl.question('\nWould you like to create the config file now? ', (answer) => {
    if ((/^y(es)?$/i).test(answer)) {
      rl.question('Org ID: ', org => {
        rl.question('Source ID: ', source => {
          rl.question('API key: ', apiKey => {
            rl.close();
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