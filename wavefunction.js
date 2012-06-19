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

var bot = {'nick': irc_nick, 'irc': irc_connection, 'channels': irc_channels};


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
