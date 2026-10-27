import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CliError } from '../src/errors.js';
import {
  countPayloadItems,
  findKeyIgnoringCase,
  looksLikePushPayload,
  normalizePayloadItems,
  validatePayload,
} from '../src/payload.js';

describe('findKeyIgnoringCase', () => {
  it('finds a key regardless of case', () => {
    assert.equal(findKeyIgnoringCase({ documentid: 1 }, 'DocumentId'), 'documentid');
    assert.equal(findKeyIgnoringCase({ DocumentId: 1 }, 'documentid'), 'DocumentId');
    assert.equal(findKeyIgnoringCase({ other: 1 }, 'DocumentId'), undefined);
  });
});

describe('normalizePayloadItems', () => {
  it('returns arrays as-is', () => {
    const items = [{ DocumentId: 'a' }, { DocumentId: 'b' }];
    assert.equal(normalizePayloadItems(items), items);
  });

  it('unwraps AddOrUpdate, whatever the case of the key', () => {
    const items = [{ DocumentId: 'a' }];
    assert.equal(normalizePayloadItems({ AddOrUpdate: items }), items);
    assert.equal(normalizePayloadItems({ addOrUpdate: items }), items);
    assert.equal(normalizePayloadItems({ ADDORUPDATE: items }), items);
  });

  it('wraps a single item into an array', () => {
    const item = { DocumentId: 'a' };
    assert.deepEqual(normalizePayloadItems(item), [item]);
  });

  it('rejects AddOrUpdate that is not an array', () => {
    assert.throws(() => normalizePayloadItems({ AddOrUpdate: {} }, 'file.json'), {
      name: 'CliError',
      message: /Invalid payload in file\.json: AddOrUpdate must be an array/,
    });
  });

  it('rejects scalars', () => {
    assert.throws(() => normalizePayloadItems('nope', 'file.json'), CliError);
    assert.throws(() => normalizePayloadItems(null, 'file.json'), CliError);
  });
});

describe('countPayloadItems', () => {
  it('counts items of every supported shape', () => {
    assert.equal(countPayloadItems(null), 0);
    assert.equal(countPayloadItems([]), 0);
    assert.equal(countPayloadItems([{}, {}]), 2);
    assert.equal(countPayloadItems({ AddOrUpdate: [{}, {}, {}] }), 3);
    assert.equal(countPayloadItems({ addOrUpdate: [{}] }), 1);
    assert.equal(countPayloadItems({ DocumentId: 'a' }), 1);
    assert.equal(countPayloadItems({ AddOrUpdate: 'bad' }), 1);
  });
});

describe('looksLikePushPayload', () => {
  it('accepts arrays and AddOrUpdate objects only', () => {
    assert.equal(looksLikePushPayload([]), true);
    assert.equal(looksLikePushPayload({ AddOrUpdate: [] }), true);
    assert.equal(looksLikePushPayload({ addorupdate: [] }), true);
    assert.equal(looksLikePushPayload({ DocumentId: 'a' }), false);
    assert.equal(looksLikePushPayload(null), false);
  });
});

describe('validatePayload', () => {
  const noWarn = { warn: () => {} };

  it('wraps an array into AddOrUpdate', () => {
    const items = [{ DocumentId: 'a', FileExtension: '.txt' }];
    assert.deepEqual(validatePayload(items, noWarn), { AddOrUpdate: items });
  });

  it('wraps a single document into AddOrUpdate', () => {
    const item = { DocumentId: 'a', FileExtension: '.txt' };
    assert.deepEqual(validatePayload(item, noWarn), { AddOrUpdate: [item] });
  });

  it('keeps a well-formed payload untouched', () => {
    const payload = { AddOrUpdate: [{ DocumentId: 'a', FileExtension: '.txt' }], Delete: [] };
    assert.equal(validatePayload(payload, noWarn), payload);
  });

  it('normalizes the case of the AddOrUpdate key and keeps sibling keys', () => {
    const items = [{ documentid: 'a', fileextension: '.txt' }];
    assert.deepEqual(validatePayload({ addOrUpdate: items, Delete: [] }, noWarn), { Delete: [], AddOrUpdate: items });
  });

  it('rejects documents without DocumentId', () => {
    assert.throws(() => validatePayload([{ title: 'no id' }], noWarn), {
      name: 'CliError',
      message: /Missing DocumentId/,
    });
  });

  it('rejects empty or scalar payloads', () => {
    assert.throws(() => validatePayload(undefined, noWarn), CliError);
    assert.throws(() => validatePayload(42, noWarn), CliError);
    assert.throws(() => validatePayload({ AddOrUpdate: 'x' }, noWarn), CliError);
  });

  it('warns once when FileExtension is missing', () => {
    const warnings = [];
    validatePayload([{ DocumentId: 'a' }, { DocumentId: 'b' }], { warn: (m) => warnings.push(m) });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Missing FileExtension/);
  });
});
