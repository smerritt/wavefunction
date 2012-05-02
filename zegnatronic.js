#!/usr/bin/env node

var irc_server = process.env.Z_IRC_SERVER
var irc_nick = process.env.Z_IRC_NICK
var irc_channels = process.env.Z_IRC_CHANNELS.split(",")

irc = require("irc");
irc_connection = irc.Client(irc_server, irc_nick, {
    channels: irc_channels,
    floodProtection: true,
    floodProtectionDelay: 333,
    autoConnect: true,
    autoRejoin: true,
    stripColors: true
});

var bot = {'nick': irc_nick, 'irc': irc_connection};


// function PrivateMessage(sender, text, raw_message) {
//     this.sender = sender;
//     this.text = text;
//     this.raw = raw_message;
// }

// PrivateMessage.prototype.reply = function(text) {
//     bot.irc.
// };


// set up messageToMe event so not everyone has to reimplement nick-parsing
bot.irc.addListener('message#', function(sender, to, text, message) {
    if (message.indexOf(bot.nick + ":") == 0) {
        bot.irc.emit('messageToMe', sender, text, message);
    }
});

bot.irc.addListener('pm', function(sender, text, message) {
    bot.irc.emit('messageToMe', sender, text, message);
});

bot.irc.addListener('messageToMe', function(sender, text, message) {
    echo_index = text.indexOf("echo ");
    if (echo_index > 0) {
        bot.irc.send(sender, text.substring(echo_index + "echo ".length,
                                            text.length));
    }
        
    
});
