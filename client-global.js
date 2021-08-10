#!/usr/bin/env node
const { main, Config } = require('./push.js');


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
  .demandCommand(1, 'You need to specify a FILE or a FOLDER\n')
  .help()
  .argv;

const FILE_OR_FOLDER = argv._[0];

let configFile = `${process.cwd()}/.pushapi-config.json`;
if (!fs.existsSync(configFile)) {
  console.warn(`\n\tCouldn't load ${configFile} file`);
  Config.createConfig(configFile, main);
} else {
  return main(FILE_OR_FOLDER);
}
