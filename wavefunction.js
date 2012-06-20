#!/usr/bin/env node

var irc_server = process.env.IRC_SERVER;
var irc_nick = process.env.IRC_NICK;
var irc_channels = process.env.IRC_CHANNELS.split(",");

var fs = require("fs");

var irc = require("irc");
var irc_connection = new irc.Client(irc_server, irc_nick, {
    channels: irc_channels,
    debug: true,
    floodProtection: true,
    floodProtectionDelay: 333,
    autoConnect: true,
    autoRejoin: true,
    stripColors: true
});

// Bot class for top-level bot object (the thing that gets passed to
// module.exports for plugins)
function Bot(nick, irc_connection, channels) {
    this.nick = irc_nick;
    this.irc = irc_connection;
    this.channels = irc_channels.map(function(channel_and_maybe_password) {
        return channel_and_maybe_password.split(/ +/)[0];
    }),
    this.top_level_help = [];
    this.command_help = {};
}

// help system should be set up before anything else runs so that
// plugins can add help text inside module.exports
Bot.prototype.add_top_level_help = function(help_message) {
    this.top_level_help.push(help_message);
    this.top_level_help.sort();
};

Bot.prototype.add_command_help = function(command, help_message) {
    this.command_help['command'] = help_message;
}

var bot = new Bot(irc_nick, irc_connection, irc_channels);

bot.irc.addListener('message#', function(nick, channel, text, message) {
    // Don't spew help into channels; it's annoying. Just tell people
    // to PM for help.
    if (text.indexOf(bot.nick + ":") == 0) {
        var words = text.split(/\s+/);
        if (words.length >= 2 && words[1] === 'help') {
            bot.irc.say(channel, nick + ": " + "to get help, use \"/msg " +
                        bot.nick + " help [command]");
        }
    }
});

bot.irc.addListener('pm', function(nick, text, message) {
    var words = text.split(/\s+/);
    if (words.length > 0 && words[0] === 'help') {

        if (words.length == 1) {
            bot.irc.say(nick, "Available commands:");
            bot.top_level_help.forEach(function(m) {
                bot.irc.say(nick, m);
            });
        } else if (words.length >= 2) {
            var command = words[1];
            var help = bot.command_help[command]
            if (typeof(help) === "string") {
                bot.irc.say(nick, "Help for " + command + ":");
                bot.irc.say(nick, help);
            } else if (typeof(help) === "undefined") {
                bot.irc.say(nick, "No help for \"" + command + "\"");
            } else {
                bot.irc.say(nick, "Help for " + command + ":");
                help.forEach(function(m) {
                    bot.irc.say(nick, m);
                });
            }
        }

        bot.irc.say(nick, "End of help.");
    }
});


// represents a message in a channel
function InChannelMessage(sender_nick, to, text, raw_message) {
    this.sender_nick = sender_nick;
    this.channel = to;
    this.text = text;
    this.raw = raw_message;
    this.bot = bot;  // NB: closed over
}

InChannelMessage.prototype.reply = function(text) {
    this.bot.irc.say(this.channel, text);
};


// represents a private message
function PrivateMessage(sender_nick, text, raw_message) {
    this.sender_nick = sender_nick;
    this.text = text;
    this.raw = raw_message;
    this.bot = bot;
}

PrivateMessage.prototype.reply = function(text) {
    this.bot.irc.say(this.sender_nick, text);
};


// set up messageToMe event so not everyone has to reimplement nick-parsing
bot.irc.addListener('message#', function(nick, to, text, message) {
    if (text.indexOf(bot.nick + ":") == 0) {
        bot.irc.emit('messageToMe', new InChannelMessage(nick, to, text, message));
    }
});

bot.irc.addListener('pm', function(nick, text, message) {
    bot.irc.emit('messageToMe', new PrivateMessage(nick, text, message));
});


// Now we have a wide variety of useful (ha!) plugins.
fs.readdirSync("./plugins").forEach(function(filename) {
    filename = "./plugins/" + filename;
    console.log("loading plugin " + filename);
    if (filename.match(/\.js$/)) {
        var plugin = require(filename);
        plugin(bot);
    }
});
