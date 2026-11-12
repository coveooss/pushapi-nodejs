import { chmod, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

import { CliError } from './errors.js';

export const CONFIG_FILE_NAME = '.pushapi-config.json';
export const DEFAULT_PLATFORM = 'push.cloud.coveo.com';

const PLACEHOLDERS = {
  apiKey: 'xx--your-api-key--abc',
  org: 'your-org-id',
  source: 'your-source-id',
};

const EXIT_CODES = {
  missingFile: 1,
  missingConfig: 2,
  apiKey: 3,
  org: 4,
  source: 5,
};

const isYes = (answer) => /^y(es)?$/i.test(answer);

export default class Config {
  /**
   * Resolves the config file to use: `configFile` when given, otherwise `.pushapi-config.json` in `dir`.
   * @param {string} [configFile] path to a config file, relative to `dir`
   * @param {string} [dir] defaults to the current working directory
   * @returns {string} the absolute path of the config file
   */
  static resolvePath(configFile, dir = process.cwd()) {
    return path.resolve(dir, configFile || CONFIG_FILE_NAME);
  }

  /**
   * Loads and validates `.pushapi-config.json` from `dir`.
   * @param {string} [dir] defaults to the current working directory
   * @returns {Promise<object>} the validated config
   */
  static load(dir = process.cwd()) {
    return Config.loadFile(Config.resolvePath(undefined, dir));
  }

  /**
   * Loads and validates the config file at `configFile`.
   * @param {string} configFile path to the config file (relative paths are resolved from the current working directory)
   * @returns {Promise<object>} the validated config
   */
  static async loadFile(configFile) {
    const resolved = path.resolve(configFile);
    let config;
    try {
      config = JSON.parse(await readFile(resolved, 'utf8'));
    } catch (cause) {
      throw new CliError(`Couldn't load config file ${resolved}`, { exitCode: EXIT_CODES.missingFile, cause });
    }
    return Config.validate(config, resolved);
  }

  /**
   * Validates a config object, filling in defaults.
   * @param {object} config
   * @param {string} [configFile] name of the file the config came from, for error messages
   * @returns {object} the same object, with defaults applied
   */
  static validate(config, configFile = CONFIG_FILE_NAME) {
    if (!config || typeof config !== 'object') {
      throw new CliError(`Missing config (${configFile})`, { exitCode: EXIT_CODES.missingConfig });
    }
    config.platform ||= DEFAULT_PLATFORM;

    for (const field of ['apiKey', 'org', 'source']) {
      if (!config[field] || config[field] === PLACEHOLDERS[field]) {
        throw new CliError(`Missing ${field} in ${configFile}`, { exitCode: EXIT_CODES[field] });
      }
    }
    return config;
  }

  /**
   * Interactively creates the config file.
   * @param {string} configFilePath
   * @returns {Promise<boolean>} true when the file was created, false when the user declined
   */
  static async createConfig(configFilePath) {
    const rl = createInterface({ input: stdin, output: stdout });

    // Lines received while no question is pending (e.g. piped stdin) are kept for the next question.
    const pendingLines = [];
    rl.on('line', (line) => pendingLines.push(line));
    // If stdin closes before every question is answered, bail out instead of hanging forever.
    const closed = new Promise((_, reject) => {
      rl.once('close', () => reject(new CliError('Input closed before the config was complete. No config file created.')));
    });
    closed.catch(() => {});

    const ask = async (message) => {
      if (pendingLines.length > 0) {
        const answer = pendingLines.shift();
        stdout.write(`${message}${answer}\n`);
        return answer.trim();
      }
      const answer = await Promise.race([rl.question(message), closed]);
      return answer.trim();
    };

    try {
      const shouldCreate = await ask('\nWould you like to create the config file now? [Y/n] ');
      if (shouldCreate && !isYes(shouldCreate)) {
        return false;
      }

      const source = await ask('Source ID: ');
      const isCatalogSource = isYes(await ask('Is it a Catalog Source? [y/N] '));

      const orgFromSourceId = source.split('-')[0];
      const org = (await ask(`Org ID: [${orgFromSourceId}] `)) || orgFromSourceId;

      let platform = (await ask('Platform (empty for prod) [dev, stg, hipaa]: ')).toLowerCase();
      if (platform && !/^(dev|stg|hipaa|prod)$/.test(platform)) {
        console.warn('Invalid platform, defaulting to prod');
        platform = '';
      }
      if (platform === 'prod') {
        platform = '';
      }

      const apiKey = await ask('API key: ');

      const payload = {
        org,
        source,
        apiKey,
        platform: `push${platform}.cloud.coveo.com`,
      };
      if (isCatalogSource) {
        payload.useStreamApi = true;
      }

      console.log('creating file: ', configFilePath);
      await writeFile(configFilePath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
      await chmod(configFilePath, 0o600);
      return true;
    } finally {
      rl.close();
    }
  }
}
