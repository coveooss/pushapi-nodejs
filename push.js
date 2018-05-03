const fs = require('fs'),
    PushApiHelper = require('./PushApiHelper');

const FILE_OR_FOLDER = process.argv[2];

function pushFile (pushApiHelper, file) {
    fs.readFile(file, (err, data) => {
        if (!err) {
            try {
                pushApiHelper.pushFile(JSON.parse(data));
            }
            catch (e) {
                console.warn('Invalid payload.');
                console.warn(e);
                return;
            }
        }
        else {
            console.log(`\nCouldn't read file "${file}": \n\t`, err);
        }
    });
}

let stats = fs.statSync(FILE_OR_FOLDER);
if (stats.isDirectory()) {
    let folderName = FILE_OR_FOLDER;
    // process every .json files in the folder as separate batch requests.
    fs.readdir(`${__dirname}/${folderName}`, (err, data) => {
        let pushApiHelper = new PushApiHelper();
        data
            .filter(fileName => (/\.json$/.test(fileName)))
            .forEach(fileName => {
                pushFile(pushApiHelper, `${__dirname}/${folderName}/${fileName}`);
            });
    });
}
else if (stats.isFile()) {
    pushFile(new PushApiHelper(), FILE_OR_FOLDER);
}
else {
    let processName = (process.argv[1] || '').split('/').pop();
    console.log(`MISSING or INVALID [FILE_OR_FOLDER].\n\n  Usage:\n\t node ${processName} file.json\\t node ${processName} folderName\n`);
}

