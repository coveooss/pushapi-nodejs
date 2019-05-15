const fs = require('fs');
const PushApiHelper = require('./PushApiHelper');

async function main() {
  try {
    // set to 30 hours ago
    const orderingId = Date.now() - (1000*60*60 * 30);

    let pushApiHelper = new PushApiHelper();
    pushApiHelper.deleteOlderThan(orderingId);
  } catch (e) {
    PushApiHelper.throwError(e, 10);
  }
}

let configFile = `${process.cwd()}/.pushapi-config.json`;
if (!fs.existsSync(configFile)) {
  console.warn(`\n\tCouldn't load ${configFile} file`);
  process.exit();
} else {
  return main();
}