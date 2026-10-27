import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import Config, { CONFIG_FILE_NAME, DEFAULT_PLATFORM } from '../src/Config.js';

const validConfig = () => ({ org: 'myorg', source: 'myorg-abc123', apiKey: 'xx-secret' });

describe('Config.validate', () => {
  it('fills in the default platform', () => {
    const config = Config.validate(validConfig());
    assert.equal(config.platform, DEFAULT_PLATFORM);
  });

  it('keeps a custom platform', () => {
    const config = Config.validate({ ...validConfig(), platform: 'pushdev.cloud.coveo.com' });
    assert.equal(config.platform, 'pushdev.cloud.coveo.com');
  });

  it('rejects a missing config with exit code 2', () => {
    assert.throws(() => Config.validate(null), { name: 'CliError', exitCode: 2 });
  });

  it('rejects missing or placeholder fields with their own exit code', () => {
    const cases = [
      ['apiKey', 3],
      ['org', 4],
      ['source', 5],
    ];
    for (const [field, exitCode] of cases) {
      const missing = validConfig();
      delete missing[field];
      assert.throws(() => Config.validate(missing), { exitCode, message: new RegExp(`Missing ${field}`) }, `missing ${field}`);

      const placeholder = validConfig();
      placeholder[field] = { apiKey: 'xx--your-api-key--abc', org: 'your-org-id', source: 'your-source-id' }[field];
      assert.throws(() => Config.validate(placeholder), { exitCode }, `placeholder ${field}`);
    }
  });
});

describe('Config.load', () => {
  it('loads and validates the config file from a folder', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'pushapi-'));
    await writeFile(path.join(dir, CONFIG_FILE_NAME), JSON.stringify(validConfig()));

    const config = await Config.load(dir);
    assert.equal(config.org, 'myorg');
    assert.equal(config.platform, DEFAULT_PLATFORM);
  });

  it('fails with exit code 1 when the file is missing', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'pushapi-'));
    await assert.rejects(Config.load(dir), { name: 'CliError', exitCode: 1, message: /Couldn't load/ });
  });

  it('fails with exit code 1 when the file is not valid JSON', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'pushapi-'));
    await writeFile(path.join(dir, CONFIG_FILE_NAME), '{ not json');
    await assert.rejects(Config.load(dir), { name: 'CliError', exitCode: 1 });
  });
});
