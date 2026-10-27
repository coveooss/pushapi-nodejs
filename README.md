# PushAPI-node.js

[![CI](https://github.com/coveooss/pushapi-nodejs/actions/workflows/ci.yml/badge.svg)](https://github.com/coveooss/pushapi-nodejs/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/coveo-pushapi-cli)](https://www.npmjs.com/package/coveo-pushapi-cli)

Command line tool to push JSON payloads to a Coveo [Push source](https://docs.coveo.com/en/68/cloud-v2-developers/push-api) (or a Catalog source, through the Stream API).

## Requirements

- Node.js **24** or newer (see `.nvmrc`).
- No runtime dependencies: HTTP calls use Node's built-in `fetch`, and arguments are parsed with `node:util.parseArgs`.

## Install

```bash
npm install --global coveo-pushapi-cli
```

## Usage

The first time you run `pushapi` in a folder, it helps you create the config file `.pushapi-config.json` by asking for your source ID, organization ID, platform and API key. The file is created with `0600` permissions since it holds your API key. Don't commit it.

```bash
# Push one JSON payload file. Don't forget to set DocumentId in the payloads.
pushapi file.json

# Push one file, then delete every item of the source that is older than 24 hours.
# Typical when you create/update all valid items and want the leftovers gone.
pushapi file.json -d 24

# Push every .json file of a folder, batched into as few requests as possible.
pushapi folder

# Dry run: build the batch files (.pushapi.buffer.N) locally, without pushing anything.
pushapi folder --dry-run

pushapi --help
```

| Option | Description |
| --- | --- |
| `-d, --deleteOlderThan <hours>` | Delete source items older than `<hours>` before pushing. |
| `-D, --dry-run` | Create the batch files without pushing them. |
| `--help`, `--version` | Show help / version. |

Uploads accept a mix of these JSON formats, including within the same folder:

- an array of items
- a Push API payload: `{ "AddOrUpdate": [ ... ] }`
- a single item object

See the `samples/` folder for examples.

### Config file

```json
{
  "org": "your-org-id",
  "source": "your-source-id",
  "apiKey": "xx--your-api-key--abc",
  "platform": "push.cloud.coveo.com",
  "useStreamApi": false,
  "debug": false
}
```

| Key | Description |
| --- | --- |
| `org` | Coveo organization ID. |
| `source` | Push (or Catalog) source ID. |
| `apiKey` | API key with the `Edit` privilege on the source. |
| `platform` | Push API host. Defaults to `push.cloud.coveo.com`. Use `pushdev.`, `pushstg.` or `pushhipaa.` for the other platforms. |
| `useStreamApi` | `true` for a Catalog source: payloads go through the [Stream API](https://docs.coveo.com/en/p4eb0129/) instead of the Push API. |
| `debug` | `true` to log every request and its response code. |

## What does it do?

The tool does a minimal validation of the payload (every document needs a `DocumentId`), then runs these API calls:

1. Change the source state to `REBUILD`
2. Get a file container
3. Upload the payload to the file container
4. Send the batch command to process the file container
5. Change the source state back to `IDLE` (even if a previous step failed)

With `useStreamApi`, it instead opens a stream, uploads one chunk per batch, and closes the stream.

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. |
| `1` | Missing config file, missing input file, or invalid payload. |
| `2` to `5` | Invalid config: missing config / `apiKey` / `org` / `source`. |
| `10` | A request to the platform failed. The response body is printed. |

## Programmatic use

The package is an ES module. It can also be loaded with `require()` on Node 24+.

```js
import { main } from 'coveo-pushapi-cli';

// Reads .pushapi-config.json from the current folder.
await main('folder-with-payloads', { deleteOlderThan: 24, dryRun: false });
```

## Development

```bash
git clone https://github.com/coveooss/pushapi-nodejs.git
cd pushapi-nodejs
npm install
npm test        # node --test
npm run lint    # eslint
```

Tests run against a mocked `fetch`; nothing is pushed to Coveo. CI runs lint and tests on every Node release line declared in `engines`.

## Contributing

- Branch or fork
- Pull request
- And... that's pretty much it!

## Authors

- Jérôme Devost ([GitHub profile](https://github.com/jdevost))

## License

[Apache-2.0](LICENSE)
