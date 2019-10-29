# PushAPI-node.js

## Description

This project is a simple wrapper to help sending JSON payloads using Coveo Cloud V2 PushAPI.

## Available documentation

The code in this project uses the Push API from the Coveo Cloud V2 Platform. You can use the following resource for more information and get started:

- Push API documentation: https://docs.coveo.com/en/68/cloud-v2-developers/push-api

## Contributing

- Branch or Fork
- Pull Request
- And... that's pretty much it!

## How-to build

1. `git clone` this project.
1. `npm install` to get the dependencies (request, fs).

## CLI command

Install it with NPM:

```
npm i coveo-pushapi-cli --global
```

## How-to run

The first time you run in one folder, it will help you to set up your config `.pushapi-config.json` by asking about your `sourceId` and your `API key`.

> **Note**
> For a source in a Coveo Cloud HIPAA org, you need to manually add the following line to the `.pushapi-config.json` file:
>
> `"platform": "pushhipaa.cloud.coveo.com"`.

- Push one JSON payload file:

    `pushapi file.json`

    where `file.json` is a the path to a Push API payload (JSON) file. Don't forget to set `DocumentId` in the payloads.

- Push one JSON payload file, but delete source item older than 24 hours:

    `pushapi file.json -d 24`

    to use typically when you create/update all valid items, you want to delete all othere items that are older. 

- Push all JSON payload files from one folder:

    `pushapi folder`

    where `folder` is teh path to a folder containing multiple Push API JSON payload files.

## What does it do?

The helper does a minimal validation on the payload, then executes these API calls:

1. Change source state to REBUILD
2. Get a File container
3. Upload the payload to the File container
4. Sends the batch command to process the File container
5. Change the source state back to IDLE

> **Note**
> You can add this attribute `"debug": true` in your `.pushapi-config.json` to see these requests and their response code.

## Dependencies

- Node.js
- Node modules: `fs`, `request`

## Authors

- Jérôme Devost (https://github.com/jdevost)
s