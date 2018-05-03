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


## Dependencies
- Node.js
- Node modules: `fs`, `request`

## Authors
- Jérôme Devost (https://github.com/jdevost)
