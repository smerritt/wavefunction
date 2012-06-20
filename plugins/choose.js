// Decide between multiple choices.

function decide(choices) {
    return choices[Math.floor(Math.random() * choices.length)];
}

module.exports = function(bot) {
    bot.add_top_level_help('choose A [B] [C]...: randomly choose an option');

    bot.irc.addListener('messageToMe', function(message) {
        var command_start = "choose ";
        var start = message.text.indexOf(command_start);
        if (start >= 0) {
            var choices = message.text.
                substring(start + command_start.length).
                split(/\s+/).
                filter(function(w) { return (w.length > 0); });
            if (choices.length > 0) {
                var chosen = decide(choices);
                message.reply("I choose " + chosen);
            }
        }
    });
};

