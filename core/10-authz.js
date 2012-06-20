// Authorization framework. Provides `bot.authz` object as well as IRC
// commands to update permissions.
//
// Requires plugin 'brain'.
//
// Internal API:
// 
// bot.is_authorized(nick, channel, perm): does #channel's person
// named 'nick' have permission perm?
//
// bot.grant(nick, channel, perm)
// bot.revoke(nick, channel, perm): grant/revoke permissions
//
// Any user whose nick is in process.env.ADMINS automatically has
// every permission.
function Authz(brain) {
    this.admins = (process.env.ADMINS || "").split(",");

    this.brain = brain;
    if (!brain.data.permissions) {
        brain.data.permissions = {};
        brain.save();
    }
}

Authz.prototype.is_bot_admin = function(nick) {
    return (this.admins.indexOf(nick) >= 0);
};

Authz.prototype.is_channel_admin = function(nick, channel) {
    return this.is_bot_admin(nick) || this.is_authorized(nick, channel, "admin");
};

Authz.prototype.is_authorized = function(nick, channel, perm) {
    if (this.is_admin(nick)) {
        return true;
    }
    
    if (!this.brain.data.permissions[nick])
        return false;
    if (!this.brain.data.permissions[nick][channel])
        return false;

    return (this.brain.data.permissions[nick][channel].indexOf(perm) >= 0);
};

Authz.prototype.grant = function(nick, channel, perm) {
    if (!this.brain.data.permissions[nick]) {
        this.brain.data.permissions[nick] = {};
    }
    if (!this.brain.data.permissions[nick][channel]) {
        this.brain.data.permissions[nick][channel] = [];
    }

    // don't double-grant
    var perms = this.brain.data.permissions[nick][channel];
    if (perms.indexOf(perm) < 0) {
        perms.push(perm);
        this.brain.save();
    }
};

Authz.prototype.revoke = function(nick, channel, perm) {
    if (!this.brain.data.permissions[nick]) {
        return;
    }
    if (!this.brain.data.permissions[nick][channel]) {
        return;
    }

    var perms = this.brain.data.permissions[nick][channel];
    var i = perms.indexOf(perm);
    
    if (i >= 0) {
        perms.splice(i, 1);
        this.brain.save();
    }
};

Authz.prototype.get_permissions = function(nick) {
    if (!this.brain.data.permissions[nick]) {
        return {};
    }
    return this.brain.data.permissions[nick];
};


module.exports = function(bot) {
    bot.authz = new Authz(bot.brain);

    bot.add_top_level_help("authz: commands for user authorization");
    bot.add_command_help(
        "authz", [
            "authz grant <nick> <channel> <permission>: grant a permission. Issuer must have 'admin' permission for <channel> (or be a bot admin).",
            "authz list: list your permissions",
            "authz list <nick>: list permissions for <nick>. Issuer must be a bot admin.",
            "authz revoke <nick> <channel> <permission>: revoke a permission. Issuer must have 'admin' permission for <channel> (or be a bot admin)."
        ]
    );

    bot.irc.addListener('pm', function(nick, text, message) {
        var words = text.split(/\s+/);
        if (words[0] !== "authz" || words.length < 2)
            return;

        if (words[1] === "list" && words.length == 2) {
            // list the requestor's permissions
            bot.irc.say(nick, "Your permissions:");
            var perms = bot.authz.get_permissions(nick);
            Object.keys(perms).forEach(function(channel) {
                if (perms[channel].length > 0) {
                    bot.irc.say(nick, channel + ": " + perms[channel].join(', '));
                }
            });
            if (bot.authz.is_bot_admin(nick)) {
                bot.irc.say(nick, "You are a bot admin.");
            }
            bot.irc.say(nick, "End of permissions.");
        } else if (words[1] === "list") {
            // list someone else's permissions
            if (!bot.authz.is_bot_admin(nick)) {
                bot.irc.say(nick, "Permission denied: you are not a bot admin");
            } else {
                var target_nick = words[2];
                bot.irc.say(nick, "Permissions for " + target_nick + ":");

                var perms = bot.authz.get_permissions(target_nick);
                Object.keys(perms).forEach(function(channel) {
                    if (perms[channel].length > 0) {
                        bot.irc.say(nick, channel + ": " + perms[channel].join(', '));
                    }
                });
                if (bot.authz.is_bot_admin(target_nick)) {
                    bot.irc.say(nick, target_nick + " is a bot admin.");
                }
                bot.irc.say(nick, "End of permissions.");
            }
        } else if (words[1] === "grant" && words.length == 5) {
            // give someone permissions
            var grantee_nick = words[2];
            var grantee_channel = words[3];
            var perm = words[4];
            if (bot.authz.is_channel_admin(nick, grantee_channel)) {
                bot.authz.grant(grantee_nick, grantee_channel, perm);
                bot.irc.say(nick, "ok");
            } else {
                bot.irc.say(nick, "Permission denied: you are not an admin for channel " + grantee_channel);
            }
        } else if (words[1] === "revoke" && words.length == 5) {
            var revokee_nick = words[2];
            var revokee_channel = words[3];
            var perm = words[4];
            if (bot.authz.is_channel_admin(nick, revokee_channel)) {
                bot.authz.revoke(revokee_nick, revokee_channel, perm);
                bot.irc.say(nick, "ok");
            } else {
                bot.irc.say(nick, "Permission denied: you are not an admin for channel " + revokee_channel);
            }
        } else {
            bot.irc.say(nick, "Unknown or malformed command; say 'help authz' for help");
        }
    });
};
