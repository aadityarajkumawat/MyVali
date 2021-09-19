"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = void 0;
const discord_js_1 = require("discord.js");
const constants_1 = require("./constants");
exports.client = new discord_js_1.Client({ intents: constants_1.intents });
//# sourceMappingURL=client.js.map