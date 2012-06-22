// Log IRC channels to files on the local filesystem
var fs = require("fs");
var path = require("path");
var http = require("http");

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
    var month = date.getUTCMonth() + 1;  // 0-based? wtf?
    var day = date.getUTCDate();

    if (month < 10) {
        // handy builtins for string formatting? nope!
        month = "0" + month;
    }
    if (day < 10) {
        day = "0" + day;
    }

    return path.join('channel_logs',
                     channel,
                    '' + year + month + day + '.txt');
};

ChannelLogger.prototype.get_logs_for_channel = function(channel, cb) {
    var logdir = path.join('channel_logs', channel);
    fs.readdir(logdir, function(err, entries) {
        if (err && err.code === "ENOENT") {
            cb(null, []);
        }
        else if (err) {
            cb(err, null);
        }
        else {
            logs = entries.filter(function(filename) {
                return filename.match(/^\d{8,}\.txt$/);
            });
            logs.sort();
            cb(null, logs.map(function(filename) {
                return path.join(logdir, filename);
            }));
        }
    });
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
                    fs.close(fd);
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

// Create a pastie.
//
// :param contents: the text of the pastie
// :param cb: a two-argument callback. Arguments are (error,
// pastie-URL). Only one will be set.

function create_pastie(contents, cb) {
    var request_json = new Buffer(
        JSON.stringify({
            'language': 'text',
            'code': contents,
            'private': true,
        }),
        "utf8");

    var request_options = {
        'hostname': 'paste.openstack.org',
        'method': 'POST',
        'path': '/json/?method=pastes.newPaste',
        'headers': {
            'Content-Type': 'application/json',
            'Content-Length': request_json.length},
        'agent': false     // set Connection: close
    };

    var received_data = "";
    var request = http.request(request_options, function(response) {
        if (response.statusCode < 200 || response.statusCode > 299) {
            cb("Got non-2xx status " + response.statusCode, null);
            // don't set up listeners; we've reported the error and no
            // longer care what's going on with this request
            return;
        }

        response.setEncoding('utf8')
        response.on('data', function(chunk) {
            received_data += chunk;
        });
        response.on('end', function() {
            response_obj = JSON.parse(received_data);
            var pastie_error = response_obj.error;
            if (pastie_error) {
                cb(pastie_error, null);
            }
            else {
                var pastie_id = response_obj.data;
                var pastie_url = "http://paste.openstack.org/show/" + pastie_id;
                cb(null, pastie_url);
            }
        });
    });
    request.on('error', function(e) { cb(e, null) });

    request.write(request_json);
    request.end();
}


module.exports = function(bot) {
    logger = new ChannelLogger();

    // we have to listen on 'message' here, not 'message#', because
    // the 'message' event is emitted first.
    //
    // Otherwise, something like the echo plugin gets a 'message'
    // event for "bot: echo foo", then says `bot.say(channel, "foo")`,
    // and that fires off a selfMessage event, which we then dutifully
    // log in the selfMessage listener.
    //
    // After that happens, the 'message#' event fires, and we go ahead
    // and log the "<user> bot: echo foo" line, and our log looks like
    // we're clairvoyant:
    // <bot> foo
    // <user> bot: echo foo
    bot.irc.addListener('message', function(nick, target, text, message) {
        if (target.match(/^#/)) {
            logger.log(nick, target, text);
        }
    });

    // the 'selfMessage' event isn't in the docs, so it's probably
    // more brittle than the documented events.
    bot.irc.addListener('selfMessage', function(target, text) {
        if (target.match(/^#/)) {
            logger.log(bot.nick, target, text);
        }
    });

    // Command: "history $CHANNEL"
    //
    // Makes a pastie out of the last two files' worth of the
    // channel's logs and replies with the URL. Each file is typically
    // a day, but there may be gaps if nobody said anything on a given
    // day.
    bot.add_top_level_help('history <channel>: get some history from <channel> in a pastie. Only available via PM.');

    bot.irc.addListener('pm', function(nick, text, message) {
        var words = text.split(/ +/);
        if (words.length == 2 && words[0] == "history") {
            var channel = words[1];
            if (bot.channels.indexOf(channel) < 0) {
                bot.irc.say(nick, "Unknown channel");
                return;
            }
            if (!bot.authz.is_authorized(nick, channel, "history")) {
                bot.irc.say(nick, "Permission denied: you lack the 'history' permission for " + channel);
                return;
            }

            logger.get_logs_for_channel(channel, function(err, logfiles) {
                if (err) {
                    bot.irc.say(nick, "Error getting channel logs: " + err);
                    return;
                }
                var log_contents = "";
                if (logfiles.length > 1)
                    // yes, yes, this blocks the reactor. the state of
                    // async IO on Linux is so primitive that issuing
                    // a read() call on a file always blocks the
                    // calling process, so there's no profit in
                    // writing this with callbacks.
                    log_contents += fs.readFileSync(logfiles[logfiles.length - 2], "utf8");
                if (logfiles.length > 0)
                    log_contents += fs.readFileSync(logfiles[logfiles.length - 1], "utf8");

                if (log_contents.length > 0) {
                    create_pastie(log_contents, function(err, url) {
                        if (err) {
                            bot.irc.say(nick, "Error making pastie: " + err);
                        }
                        else {
                            bot.irc.say(nick, url);
                        }
                    });
                } else {
                    bot.irc.say("No history found");
                }
            });
        }
    });
};
