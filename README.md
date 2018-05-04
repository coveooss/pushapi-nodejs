# PushAPI-node.js

## Description
This project is a simple wrapper to help sending json payloads using Coveo PushAPI.

## Available documentation
The code in this project uses the Push API from the Coveo Platform. You can use the following resource for more information and get started:

- PushAPI documentation: https://docs.coveo.com/en/68/cloud-v2-developers/push-api

## Contributing
- Branch
- Pull Request
- And... that's pretty much it!

## How-to build

1. `git clone` this project
1. `npm install` to get the dependencies (request, fs)


## How-to run

First, you need to set up your config in a file `config.json`, then simply

    node push.js file.json

or

    node push.js folder

where *file.json* is a payload (json) for the PushApi, and *folder* contains multiple payload files.
Don't forget to set **DocumentId** in the payloads.

## CLI command

Until we add it to NPM and create a command line tool, you can simulate a command line interface by using `alias` in Bash terminals. For example:
```
alias pushapi='node ~/github/pushapi-nodejs/push.js'
```

Then you will simply need to execute `pushapi file.json` from any folder.


## What does it do?

The helper does a minimal validation on the payload, then executes these API calls:

1. Change source state to REBUILD
1. Get a File container
1. Upload the payload to the File container
1. Sends the batch command to process the File container
1. Change the source state back to IDLE

You can add this attribute `"debug": true` in your **config.json** to see these requests and their response code.

## Dependencies
- Node.js
- Node modules: `fs`, `request`

## Authors
- Jérôme Devost (https://github.com/jdevost)
