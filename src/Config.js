const fs = require('fs');

class Config {

  constructor() {
    this._dir = process.cwd();

    try {
      this.config = require(`${this._dir}/.pushapi-config`);
    } catch (e) {
      Config.throwError(`Couldn't load .pushapi-config.json file from ${this._dir}`);
    }

    this.validateConfig();
    return this.config;
  }

  validateConfig() {
    if (!this.config) {
      Config.throwError('Missing config (.pushapi-config.json)', 2);
    }
    if (!this.config.platform) {
      this.config.platform = 'push.cloud.coveo.com';
    }

    if (!this.config.apiKey || this.config.apiKey === 'xx--your-api-key--abc') {
      Config.throwError('Missing apiKey in .pushapi-config.json', 3);
    }
    if (!this.config.org || this.config.org === 'your-org-id') {
      Config.throwError('Missing org in .pushapi-config.json', 4);
    }
    if (!this.config.source || this.config.source === 'your-source-id') {
      Config.throwError('Missing source in .pushapi-config.json', 5);
    }
  }

  static async ask(rl, message) {
    return new Promise(resolve => {
      rl.question(message, answer => {
        resolve((answer || '').trim());
      });
    });
  }

  static async createConfig(configFilePath, callback) {

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const shouldCreate = await Config.ask(rl, '\nWould you like to create the config file now? [Y/n] ');
    if (!shouldCreate || (/^y(es)?$/i).test(shouldCreate)) {

      let source = await Config.ask(rl, 'Source ID: ');

      let isCatalogSource = await Config.ask(rl, 'Is it a Catalog Source? [y/N] ');
      isCatalogSource = (/^y(es)?$/i).test(isCatalogSource);

      const orgFromSourceId = source.split('-')[0];
      let org = await Config.ask(rl, `Org ID: [${orgFromSourceId}]`);
      if (!org && orgFromSourceId) {
        org = orgFromSourceId;
      }

      const apiKey = await Config.ask(rl, `API key: `);

      rl.close();
      console.log('creating file: ', configFilePath);
      let payload = {
        org,
        source,
        apiKey
      };
      if (isCatalogSource) {
        payload.useStreamApi = true;
      }
      fs.writeFileSync(
        configFilePath,
        JSON.stringify(payload, 2, 2)
      );

      fs.chmodSync(configFilePath, 0o600);

      callback();
    } else {
      rl.close();
      process.exit();
    }
  }

  static throwError(msg, code) {
    console.warn(`\n\t${msg}`);
    process.exit(code || 1);
  }
}

module.exports = Config;
