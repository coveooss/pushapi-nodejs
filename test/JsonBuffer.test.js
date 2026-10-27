import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import JsonBuffer, { loadJsonFile } from '../src/JsonBuffer.js';

async function tempFolderWith(files) {
  const dir = await mkdtemp(path.join(tmpdir(), 'pushapi-buffer-'));
  for (const [name, content] of Object.entries(files)) {
    await writeFile(path.join(dir, name), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
}

describe('loadJsonFile', () => {
  it('reports the file name on invalid JSON', async () => {
    const dir = await tempFolderWith({ 'bad.json': '{ nope' });
    await assert.rejects(loadJsonFile(path.join(dir, 'bad.json')), { name: 'CliError', message: /Invalid JSON in .*bad\.json/ });
  });
});

describe('JsonBuffer', () => {
  beforeEach(() => {
    mock.method(console, 'log', () => {});
  });
  afterEach(() => {
    mock.restoreAll();
  });

  it('merges files of mixed shapes into a single AddOrUpdate payload', async () => {
    const dir = await tempFolderWith({
      'a.json': [{ DocumentId: 'a1' }, { DocumentId: 'a2' }],
      'b.json': { addOrUpdate: [{ DocumentId: 'b1' }] },
      'c.json': { DocumentId: 'c1' },
    });
    const pushed = [];
    const apiHelper = { pushJsonPayload: async (payload) => pushed.push(payload) };

    const buffer = new JsonBuffer(apiHelper, {});
    for (const name of ['a.json', 'b.json', 'c.json']) {
      await buffer.addJsonFile(path.join(dir, name));
    }
    await buffer.sendBuffer();

    assert.equal(buffer.totalItemCount, 4);
    assert.equal(pushed.length, 1);
    assert.deepEqual(
      pushed[0].AddOrUpdate.map((d) => d.DocumentId),
      ['a1', 'a2', 'b1', 'c1'],
    );
  });

  it('does nothing when the buffer is empty', async () => {
    const pushed = [];
    const buffer = new JsonBuffer({ pushJsonPayload: async (p) => pushed.push(p) }, {});
    await buffer.sendBuffer();
    assert.equal(pushed.length, 0);
  });

  it('writes a buffer file instead of pushing in dry-run mode', async () => {
    const dir = await tempFolderWith({ 'a.json': [{ DocumentId: 'a1' }] });
    const cwd = process.cwd();
    process.chdir(dir);
    try {
      const buffer = new JsonBuffer({ pushJsonPayload: async () => assert.fail('should not push') }, {}, true);
      await buffer.addJsonFile(path.join(dir, 'a.json'));
      await buffer.sendBuffer();

      const written = JSON.parse(await readFile(path.join(dir, '.pushapi.buffer.1'), 'utf8'));
      assert.deepEqual(written, { AddOrUpdate: [{ DocumentId: 'a1' }] });
      assert.equal(buffer.bufferCount, 2);
    } finally {
      process.chdir(cwd);
    }
  });
});
