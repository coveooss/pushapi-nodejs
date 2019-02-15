const uuidv4 = require('uuid/v4');
const fs = require('fs');
const PushApiHelper = require('./PushApiHelper');

const MAX_BUFFER_SIZE = 250 * 1024 * 1024; // 250Mb max for Push payloads

function showUsage() {
  let processName = (process.argv[1] || '').split('/').pop();
  console.log(`MISSING or INVALID [FILE_OR_FOLDER].\n\n  Usage:\n\t node ${processName} file.json\n\t node ${processName} folderName\n`);

  process.exit();
}

const FILE_OR_FOLDER = process.argv[2];
if (!FILE_OR_FOLDER) {
  showUsage();
}

function pushFile(pushApiHelper, file) {
  console.log(`Loading file: ${file}`);
  fs.readFile(file, (err, data) => {
    if (!err) {
      try {
        pushApiHelper.pushFile(JSON.parse(data));
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

function main() {
  try {
    let stats = fs.statSync(FILE_OR_FOLDER);
    if (stats.isDirectory()) {
      let _dir = process.cwd();
      let folderName = FILE_OR_FOLDER;
      folderName = folderName.replace(/\/\s*/g, '');

      // process every .json files in the folder as separate batch requests.
      console.log(`Loading folder: ${_dir}/${folderName}`);

      let buffer = [];
      let bufferSize = 0;
      let bufferCount = 1;

      let files = fs.readdirSync(`${_dir}/${folderName}`);
      let pushApiHelper = new PushApiHelper();

      files
        .filter(fileName => (/\.json$/.test(fileName)))
        .forEach(fileName => {

          // add to Buffer
          let fileSize = fs.statSync(`${_dir}/${folderName}/${fileName}`);
          fileSize = fileSize.size;

          if (fileSize + bufferSize > MAX_BUFFER_SIZE) {
            pushApiHelper.pushFile(buffer);
            buffer = [];
            bufferSize = 0;
            bufferCount++;
          } else {
            try {
              let payload = require(`${_dir}/${folderName}/${fileName}`);
              if (payload instanceof Array) {
                buffer.push(...payload);
              } else {
                buffer.push(payload);
              }
              bufferSize += fileSize;
            } catch (e) {
              console.log(e);
            }
          }
        });

      if (bufferSize > 0) {
        pushApiHelper.pushFile(buffer);
      }
      buffer = null;

    } else if (stats.isFile()) {
      pushFile(new PushApiHelper(), FILE_OR_FOLDER);
    } else {
      showUsage();
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
  main();
}