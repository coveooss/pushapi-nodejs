import fs from 'fs';

class SourceConfig {

  constructor() {
    this._dir = process.cwd();

    try {
      this.config = require(`${this._dir}/.pushapi-config`);
    } catch (e) {
      SourceConfig.throwError(`Couldn't load .pushapi-config.json file from ${this._dir}`);
    }

    this.validateConfig();
  }

  validateConfig() {
    if (!this.config) {
      SourceConfig.throwError('Missing config (.pushapi-config.json)', 2);
    }
    if (!this.config.platform) {
      this.config.platform = 'push.cloud.coveo.com';
    }

    if (!this.config.apiKey || this.config.apiKey === 'xx--your-api-key--abc') {
      SourceConfig.throwError('Missing apiKey in .pushapi-config.json', 3);
    }
    if (!this.config.org || this.config.org === 'your-org-id') {
      SourceConfig.throwError('Missing org in .pushapi-config.json', 4);
    }
    if (!this.config.source || this.config.source === 'your-source-id') {
      SourceConfig.throwError('Missing source in .pushapi-config.json', 5);
    }
  }

  static createConfig(configFilePath, callback) {

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

              console.log('creating file: ', configFilePath);
              let payload = {
                org,
                source,
                apiKey
              };
              fs.writeFileSync(
                configFilePath,
                JSON.stringify(payload, 2, 2)
              );

              fs.chmodSync(configFilePath, 0o600);

              callback();
            });
          });
        });
      } else {
        rl.close();
        process.exit();
      }
    });

  }

  static throwError(msg, code) {
    console.warn(`\n\t${msg}`);
    process.exit(code || 1);
  }
}

export default SourceConfig;
