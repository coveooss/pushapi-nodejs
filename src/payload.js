import { CliError } from './errors.js';

/**
 * The Push API JSON payload keys are case-insensitive (DocumentId === documentid).
 * @param {object} obj
 * @param {string} key
 * @returns {string | undefined} the actual key found in `obj`, if any
 */
export function findKeyIgnoringCase(obj, key) {
  const wanted = key.toLowerCase();
  return Object.keys(obj).find((k) => k.toLowerCase() === wanted);
}

export function hasKeyIgnoringCase(obj, key) {
  return findKeyIgnoringCase(obj, key) !== undefined;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Turns any supported payload shape into a flat array of items.
 * Supported shapes: an array of items, `{ "AddOrUpdate": [...] }` (any case), or a single item.
 * @param {unknown} payload
 * @param {string} source a label used in error messages (typically the file path)
 * @returns {object[]}
 */
export function normalizePayloadItems(payload, source = 'payload') {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isPlainObject(payload)) {
    const addOrUpdateKey = findKeyIgnoringCase(payload, 'AddOrUpdate');
    if (addOrUpdateKey) {
      if (!Array.isArray(payload[addOrUpdateKey])) {
        throw new CliError(`Invalid payload in ${source}: AddOrUpdate must be an array.`);
      }
      return payload[addOrUpdateKey];
    }
    return [payload];
  }

  throw new CliError(`Invalid payload in ${source}: expected an array or an object.`);
}

/**
 * Counts the items in a payload without validating it.
 * @param {unknown} payload
 * @returns {number}
 */
export function countPayloadItems(payload) {
  if (!payload) {
    return 0;
  }
  try {
    return normalizePayloadItems(payload).length;
  } catch {
    return 1;
  }
}

/**
 * Tells whether the payload looks like something the Push API will accept.
 * @param {unknown} payload
 */
export function looksLikePushPayload(payload) {
  return Array.isArray(payload) || (isPlainObject(payload) && hasKeyIgnoringCase(payload, 'AddOrUpdate'));
}

/**
 * Wraps the payload into `{ "AddOrUpdate": [...] }` and checks each document has a DocumentId.
 * @param {unknown} payload
 * @param {{ warn?: (message: string) => void }} [options]
 * @returns {{ AddOrUpdate: object[] } & Record<string, unknown>}
 */
export function validatePayload(payload, { warn = console.warn } = {}) {
  if (!payload) {
    throw new CliError('Invalid payload: not defined.');
  }

  let data;
  if (Array.isArray(payload)) {
    data = { AddOrUpdate: payload };
  } else if (!isPlainObject(payload)) {
    throw new CliError('Invalid payload: expected an array or an object.');
  } else {
    const addOrUpdateKey = findKeyIgnoringCase(payload, 'AddOrUpdate');
    if (!addOrUpdateKey) {
      data = { AddOrUpdate: [payload] };
    } else if (addOrUpdateKey === 'AddOrUpdate') {
      data = payload;
    } else {
      // AddOrUpdate is present, but with a different case: normalize the key.
      const { [addOrUpdateKey]: items, ...rest } = payload;
      data = { ...rest, AddOrUpdate: items };
    }
  }

  if (!Array.isArray(data.AddOrUpdate)) {
    throw new CliError('Invalid payload: AddOrUpdate must be an array.');
  }

  let fileExtensionWarned = false;
  for (const document of data.AddOrUpdate) {
    if (!isPlainObject(document) || !hasKeyIgnoringCase(document, 'DocumentId')) {
      throw new CliError('Missing DocumentId in some documents in the payload. Stopping.');
    }
    if (!fileExtensionWarned && !hasKeyIgnoringCase(document, 'FileExtension')) {
      warn("Missing FileExtension in some documents. It's good practice to provide them.");
      fileExtensionWarned = true;
    }
  }

  return data;
}
