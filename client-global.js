#!/usr/bin/env node
const { main, Config } = require('./push.js');

let configFile = `${process.cwd()}/.pushapi-config.json`;
if (!fs.existsSync(configFile)) {
  console.warn(`\n\tCouldn't load ${configFile} file`);
  Config.createConfig(configFile, main);
} else {
  return main();
}
