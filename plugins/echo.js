// Echoes what you tell it to.
module.exports = function(bot) {
    bot.irc.addListener('messageToMe', function(message) {
        var echo_prefix = "echo ";
        var echo_index = message.text.indexOf(echo_prefix);
        if (echo_index >= 0) {
            message.reply(message.text.substring(echo_index + echo_prefix.length,
                                                 message.text.length));
        }
    });
};
