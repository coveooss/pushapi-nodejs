const fs = require('fs'),
    PushApiHelper = require('./PushApiHelper');

function showUsage () {
    let processName = (process.argv[1] || '').split('/').pop();
    console.log(`MISSING or INVALID [FILE_OR_FOLDER].\n\n  Usage:\n\t node ${processName} file.json\n\t node ${processName} folderName\n`);

    process.exit();
}

const FILE_OR_FOLDER = process.argv[2];
if (!FILE_OR_FOLDER) {
    showUsage();
}

function pushFile (pushApiHelper, file) {
    console.log(`Loading file: ${file}`);
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

try {
    let stats = fs.statSync(FILE_OR_FOLDER);
    if (stats.isDirectory()) {
        let folderName = FILE_OR_FOLDER;
        let _dir = process.cwd();

        // process every .json files in the folder as separate batch requests.
        console.log(`Loading folder: ${_dir}/${folderName}`);
        fs.readdir(`${_dir}/${folderName}`, (err, data) => {
            let pushApiHelper = new PushApiHelper();
            data
                .filter(fileName => (/\.json$/.test(fileName)))
                .forEach(fileName => {
                    pushFile(pushApiHelper, `${_dir}/${folderName}/${fileName}`);
                });
        });
    }
    else if (stats.isFile()) {
        pushFile(new PushApiHelper(), FILE_OR_FOLDER);
    }
    else {
        showUsage();
    }

}
catch (e) {
    PushApiHelper.throwError(e, 10);
}
