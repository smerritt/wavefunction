// Provides a bit of file-backed storage for plugins to use
module.exports = function(bot) {
    var fs = require('fs');
    var path = require('path');

    var dump_dir = process.env.FILE_BRAIN_PATH || '.';
    var dump_file = path.join(dump_dir, 'thingy');

    var brain = {
        save: function() {
            console.log('Saving braindump');
            fs.writeFileSync(dump_file, JSON.stringify(this.data), 'utf-8');
        }
    };

    try {
        var loaded_data = fs.readFileSync(dump_file, 'utf-8');
        if (loaded_data.length > 0) {
            brain.data = JSON.parse(data);
        } else {
            brain.data = {};
        }
    } catch(err) {
        if (err.code != 'ENOENT') {
            console.log("Unable to read file " + dump_file, err);
        }
        brain.data = {};
    }
};
