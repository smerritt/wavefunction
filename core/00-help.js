// Provides a help system.
//
// No dependencies on other plugins, core or otherwise.

module.exports = function(bot) {
    bot.top_level_help = [];
    bot.command_help = {};

    bot.add_top_level_help = function(help_message) {
        bot.top_level_help.push(help_message);
        bot.top_level_help.sort();
    };

    bot.add_command_help = function(command, help_message) {
        bot.command_help[command] = help_message;
    };


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
                var help = bot.command_help[command];
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
};
