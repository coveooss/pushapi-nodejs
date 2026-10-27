import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { HttpError } from '../src/errors.js';
import PushApi from '../src/PushApi.js';
import StreamApi from '../src/StreamApi.js';

const config = { org: 'myorg', source: 'myorg-src', apiKey: 'xx-secret', platform: 'push.cloud.coveo.com' };

/** Replaces global fetch with a mock that answers from a queue of responses. */
function mockFetch(responses) {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    const next = responses.shift() ?? { status: 200, body: '' };
    return new Response(next.body ?? '', { status: next.status ?? 200, statusText: next.statusText ?? '' });
  });
  return {
    calls: () => fetchMock.mock.calls.map(({ arguments: [url, init] }) => ({ url: String(url), ...init })),
  };
}

describe('PushApi', () => {
  let log;
  beforeEach(() => {
    log = mock.method(console, 'log', () => {});
  });
  afterEach(() => {
    mock.restoreAll();
  });

  it('changes the source status with the API key as bearer token', async () => {
    const fetched = mockFetch([{ status: 200, body: '' }]);

    await new PushApi(config).changeStatus('REBUILD');

    const [call] = fetched.calls();
    assert.equal(call.url, 'https://push.cloud.coveo.com/v1/organizations/myorg/sources/myorg-src/status?statusType=REBUILD');
    assert.equal(call.method, 'POST');
    assert.equal(call.headers.Authorization, 'Bearer xx-secret');
  });

  it('pushes a payload: file container, AWS upload, batch request', async () => {
    const fetched = mockFetch([
      { status: 200, body: JSON.stringify({ uploadUri: 'https://s3.example.com/upload?sig=1', fileId: 'file-1' }) },
      { status: 200, body: '' },
      { status: 202, body: '' },
    ]);

    await new PushApi(config).pushFile([{ DocumentId: 'doc-1', FileExtension: '.txt' }]);

    const calls = fetched.calls();
    assert.equal(calls.length, 3);
    assert.equal(calls[0].url, 'https://push.cloud.coveo.com/v1/organizations/myorg/files');
    assert.equal(calls[1].url, 'https://s3.example.com/upload?sig=1');
    assert.equal(calls[1].method, 'PUT');
    assert.equal(calls[1].headers['x-amz-server-side-encryption'], 'AES256');
    assert.deepEqual(JSON.parse(calls[1].body), { AddOrUpdate: [{ DocumentId: 'doc-1', FileExtension: '.txt' }] });
    assert.equal(calls[2].url, 'https://push.cloud.coveo.com/v1/organizations/myorg/sources/myorg-src/documents/batch?fileId=file-1');
    assert.equal(calls[2].method, 'PUT');
  });

  it('throws an HttpError with the response body on failure', async () => {
    mockFetch([{ status: 401, statusText: 'Unauthorized', body: '{"message":"bad key"}' }]);

    await assert.rejects(new PushApi(config).changeStatus('IDLE'), (error) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.body, '{"message":"bad key"}');
      assert.match(error.message, /POST push\.cloud\.coveo\.com.*failed with status 401 Unauthorized/);
      return true;
    });
  });

  it('does not call the network in dry-run mode', async () => {
    const fetched = mockFetch([]);

    const api = new PushApi(config, true);
    await api.changeStatus('REBUILD');
    await api.pushFile([{ DocumentId: 'doc-1' }]);

    assert.equal(fetched.calls().length, 0);
    assert.ok(log.mock.calls.some(({ arguments: args }) => String(args[0]).startsWith('DRY-RUN')));
  });

  it('skips deleteOlderThan for a future orderingId', async () => {
    const fetched = mockFetch([]);
    await new PushApi(config).deleteOlderThan(Date.now() + 60_000);
    assert.equal(fetched.calls().length, 0);
  });
});

describe('StreamApi', () => {
  beforeEach(() => {
    mock.method(console, 'log', () => {});
  });
  afterEach(() => {
    mock.restoreAll();
  });

  it('targets the api host and opens, uploads, then closes the stream', async () => {
    const fetched = mockFetch([
      { status: 200, body: JSON.stringify({ uploadUri: 'https://s3.example.com/chunk-1', streamId: 'stream-1' }) },
      { status: 200, body: '' },
      { status: 200, body: '{}' },
    ]);

    await new StreamApi({ ...config, platform: 'pushdev.cloud.coveo.com' }).pushFile({ DocumentId: 'doc-1', FileExtension: '.txt' });

    const calls = fetched.calls();
    assert.equal(calls[0].url, 'https://apidev.cloud.coveo.com/push/v1/organizations/myorg/sources/myorg-src/stream/open');
    assert.equal(calls[1].url, 'https://s3.example.com/chunk-1');
    assert.equal(calls[2].url, 'https://apidev.cloud.coveo.com/push/v1/organizations/myorg/sources/myorg-src/stream/stream-1/close');
  });

  it('closes the stream even when the upload fails', async () => {
    const fetched = mockFetch([
      { status: 200, body: JSON.stringify({ uploadUri: 'https://s3.example.com/chunk-1', streamId: 'stream-1' }) },
      { status: 500, statusText: 'Internal Server Error', body: 'boom' },
      { status: 200, body: '{}' },
    ]);

    await assert.rejects(new StreamApi(config).pushFile([{ DocumentId: 'doc-1' }]), HttpError);
    assert.match(fetched.calls().at(-1).url, /stream\/stream-1\/close$/);
  });

  it('reuses the open-stream upload URI for the first chunk, then asks for new chunks', async () => {
    const fetched = mockFetch([
      { status: 200, body: JSON.stringify({ uploadUri: 'https://s3.example.com/chunk-1', streamId: 'stream-1' }) },
      { status: 200, body: '' },
      { status: 200, body: JSON.stringify({ uploadUri: 'https://s3.example.com/chunk-2' }) },
      { status: 200, body: '' },
    ]);

    const api = new StreamApi(config);
    await api.openStream();
    await api.pushJsonPayload({ AddOrUpdate: [] });
    await api.pushJsonPayload({ AddOrUpdate: [] });

    const urls = fetched.calls().map((c) => c.url);
    assert.deepEqual(urls, [
      'https://api.cloud.coveo.com/push/v1/organizations/myorg/sources/myorg-src/stream/open',
      'https://s3.example.com/chunk-1',
      'https://api.cloud.coveo.com/push/v1/organizations/myorg/sources/myorg-src/stream/stream-1/chunk',
      'https://s3.example.com/chunk-2',
    ]);
  });
});
