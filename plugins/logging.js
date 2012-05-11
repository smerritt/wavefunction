// Log IRC channels to files on the local filesystem
var fs = require("fs");
var path = require("path");

function ChannelLogger() {
    this.message_queue = [];
    this.active = false;
};

ChannelLogger.prototype.log = function(nick, channel, message) {
    this.message_queue.push([new Date(), nick, channel, message]);
    if (!this.active) {
        this.active = true;
        this.process_queue();
    }
};

ChannelLogger.prototype.file_for_item = function(item) {
    var date = item[0];
    var channel = item[2];

    var year = date.getUTCFullYear();
    var month = date.getUTCMonth();
    var day = date.getUTCDay();

    return path.join('channel_logs',
                     channel,
                    '' + year + month + day + '.txt');
};

ChannelLogger.prototype.process_queue = function() {
    var item = this.message_queue.shift();
    var logger = this;
    this.process_one_item(item, function(err) {
        if (err) {
            console.log(err);
            // it's just logging; keep going
        }
            
        if (logger.message_queue.length > 0) {
            logger.process_queue();
        } else {
            logger.active = false;
        }
    });
};

ChannelLogger.prototype.process_one_item = function(item, cb) {
    var filename = this.file_for_item(item);
    var date = item[0];
    var nick = item[1];
    var message = item[3];

    var logline = '[' + date.toUTCString() + '] <' + nick + '> ' + 
        message + "\n";
        
    var logger = this;

    this.ensure_dir_exists(path.dirname(filename), function(err) {
        if (err) {
            console.log(err);
            cb(err);
        } else {
            fs.open(filename, 'a', function(err, fd) {
                if (err) {
                    cb(err);
                } else {
                    logger.write_buffer_to_fd(fd, 
                                              new Buffer(logline, "utf-8"),
                                              cb);
                }
            });
        }
    });
};

ChannelLogger.prototype.write_buffer_to_fd = function(fd, buffer, cb, offset) {
    offset = offset || 0;

    var logger = this;
    fs.write(fd, buffer, offset, buffer.length - offset, null,
             function(err, written, buffer) {
                 if (err) {
                     console.log(err);
                     cb(err);
                 } else if (written < (buffer.length - offset)) {
                     logger.write_buffer_to_fd(fd, buffer, cb, offset + written);
                 } else {
                     cb();
                 }
             });
};


ChannelLogger.prototype.ensure_dir_exists = function(dirname, cb) {
    var logger = this;
    path.exists(dirname, function(existsp) {
        if (existsp) {
            cb(null); // dir exists already: success!
        } else {
            logger.ensure_dir_exists(path.dirname(dirname), function(err) {
                if (err) {
                    cb(err);  // failed making parent
                } else {
                    fs.mkdir(dirname, function(err) {
                        cb(err);  // tried; report success/failure to callback
                    });
                }
            });
        }
    });
};

module.exports = function(bot) {
    logger = new ChannelLogger();
    bot.irc.addListener('message#', function(nick, channel, text, message) {
        logger.log(nick, channel, text);
    });
};
