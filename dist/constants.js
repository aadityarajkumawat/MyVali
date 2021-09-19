"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.__prod__ = exports.intents = exports.SUCCESS = void 0;
const discord_js_1 = require("discord.js");
exports.SUCCESS = 202;
exports.intents = [
    discord_js_1.Intents.FLAGS.GUILDS,
    discord_js_1.Intents.FLAGS.GUILD_MESSAGES,
    'GUILD_PRESENCES',
    'GUILD_MEMBERS',
    'GUILDS',
    'GUILD_INTEGRATIONS',
];
exports.__prod__ = process.env.NODE_ENV === 'production';
//# sourceMappingURL=constants.js.map