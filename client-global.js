#!/usr/bin/env node
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import pkg from './package.json' with { type: 'json' };
import { main, reportError, Config } from './push.js';
import { CONFIG_FILE_NAME } from './src/Config.js';

const HELP = `
Usage: pushapi <File_or_Folder> [options]

Options:
  -d, --deleteOlderThan <hours>  Set the deleteOlderThan delay (in hours)
  -D, --dry-run                  Dry run - creates the batch files, without pushing them
  -h, --help                     Show help
  -v, --version                  Show version number

Examples:
  pushapi file1.json    Upload a single file to a Push Source
  pushapi folder2       Upload all .json files from a folder to a Push Source
  pushapi folder3 -d 2  Sends a deleteOlderThan 2 hours before pushing new data
`;

/** Prints the usage and the error message to stderr, then exits with code 1. */
function usageError(message) {
  console.error(HELP);
  console.error(`${message}\n`);
  process.exit(1);
}

/**
 * Parses the command line into `{ fileOrFolder, deleteOlderThan, dryRun }`.
 * Exits the process on --help, --version, or invalid arguments.
 */
function parseCommandLine(args) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        deleteOlderThan: { type: 'string', short: 'd' },
        'dry-run': { type: 'boolean', short: 'D', default: false },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
    });
  } catch (error) {
    return usageError(error.message);
  }

  const { values, positionals } = parsed;
  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }
  if (values.version) {
    console.log(pkg.version);
    process.exit(0);
  }

  if (positionals.length !== 1) {
    return usageError(positionals.length === 0 ? 'You need to specify a FILE or a FOLDER' : `Too many arguments: ${positionals.join(' ')}`);
  }

  let deleteOlderThan = null;
  if (values.deleteOlderThan !== undefined) {
    deleteOlderThan = Number(values.deleteOlderThan);
    if (values.deleteOlderThan.trim() === '' || !Number.isFinite(deleteOlderThan) || deleteOlderThan < 0) {
      return usageError(`--deleteOlderThan expects a number of hours, got: ${values.deleteOlderThan}`);
    }
  }

  return { fileOrFolder: positionals[0], deleteOlderThan, dryRun: values['dry-run'] };
}

const { fileOrFolder, ...options } = parseCommandLine(process.argv.slice(2));

try {
  const configFile = path.join(process.cwd(), CONFIG_FILE_NAME);
  if (!existsSync(configFile)) {
    console.warn(`\n\tCouldn't load ${configFile} file`);
    const created = await Config.createConfig(configFile);
    if (!created) {
      process.exit(0);
    }
  }
  await main(fileOrFolder, options);
} catch (error) {
  reportError(error);
  process.exitCode = typeof error?.exitCode === 'number' ? error.exitCode : 10;
}
