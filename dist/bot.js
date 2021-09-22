"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config();
const express_1 = __importDefault(require("express"));
const client_1 = require("./client");
const constants_1 = require("./constants");
const helpers_1 = require("./helpers");
const pino_1 = __importDefault(require("pino"));
const dataStore_1 = require("./dataStore");
const TinyURL = require('tinyurl');
const app = (0, express_1.default)();
const logger = (0, pino_1.default)({ prettifier: true, prettyPrint: { colorize: true } });
app.set('view engine', 'ejs');
app.use(express_1.default.urlencoded({ extended: false }));
app.use(express_1.default.static(__dirname + '/../public'));
let indexPageParams = {
    path: '',
    warning: '',
};
client_1.client.on('ready', function () {
    if (client_1.client.user) {
        logger.info(`${client_1.client.user.username} is now active`);
    }
    else {
        logger.error('Client is not ready at the moment');
    }
});
client_1.client.on('guildMemberAdd', function (member) {
    ;
    (async function () {
        try {
            let userId = member.user.id;
            userId = (0, helpers_1.encodeUserId)(userId);
            let user = (0, helpers_1.initializeUser)(userId);
            dataStore_1.users[userId] = user;
            logger.info(`Initialized a new user: ${member.user.username}`);
            let url = constants_1.__prod__
                ? `https://polar-citadel-65410.herokuapp.com/verify/${userId}`
                : `http://localhost:4000/verify/${userId}`;
            let shortURL = await TinyURL.shorten(url);
            await (0, helpers_1.sendDM)(userId, `Please verify your account at ${shortURL}`);
            logger.info(`sent DM to ${member.user.username}`);
        }
        catch (error) {
            logger.error(error.message);
        }
    })();
});
client_1.client.on('guildMemberRemove', (member) => {
    ;
    (async () => {
        let userLeft = member.user;
        let userId = null;
        if (userLeft) {
            userId = userLeft.id;
            delete dataStore_1.users[(0, helpers_1.encodeUserId)(userId)];
            logger.info(`Removed ${userLeft.username} from server`);
            return;
        }
        logger.error('Not able to get user from discord');
    })();
});
var getRandNumWithLimit = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};
const links = ['https://discord.gg/kfY7jqbcvu', 'https://discord.gg/V4vxB5EH4Q'];
app.get('/join', function (_, res) {
    ;
    (async () => {
        logger.info(`Join server page hit`);
        res.render('pages/getlink', { link: links[getRandNumWithLimit(0, 1)] });
    })();
});
app.get('/', function (_, res) {
    ;
    (async () => {
        logger.info(`Join server page hit`);
        res.render('pages/getlink', { link: links[getRandNumWithLimit(0, 1)] });
    })();
});
app.get('/:anything', function (_, res) {
    res.render('pages/notfound', {});
});
app.get('/verify/:userId/:error?', function (req, res) {
    ;
    (async function () {
        let { userId, error } = req.params;
        let redirectTo = `/auth/${userId}`;
        let { found: userExists } = await (0, helpers_1.findUser)(userId);
        if (userExists && !error) {
            logger.info(`${userId} is looking at the form`);
            res.render('pages/index', Object.assign(Object.assign({}, indexPageParams), { path: redirectTo }));
        }
        else if (error === 'true') {
            logger.info(`${userId} entered an undesired email address`);
            res.render('pages/index', {
                path: redirectTo,
                warning: 'Enter JKLU E-Mail address only',
            });
        }
        else {
            logger.error('IDK wtf the user was trying to do');
            res.render('pages/notfound');
        }
    })();
});
app.post('/auth/:userId', function (req, res) {
    ;
    (async function () {
        try {
            let { email, name } = req.body;
            let userId = req.params.userId;
            logger.info(`Processing ${userId}'s entered details'`);
            if (typeof req.body.role === 'string') {
                dataStore_1.users[userId].roles = [req.body.role];
            }
            else {
                dataStore_1.users[userId].roles = req.body.role;
            }
            logger.info(`The roles chosen are ${JSON.stringify(req.body.role)}`);
            let redirectTo = `/auth/${userId}`;
            let userAlreadyExists = await (0, helpers_1.doesUserAlreadyExists)(email);
            if (userAlreadyExists) {
                logger.info(`The user: ${userId} already existed, data store: ${JSON.stringify(dataStore_1.users)}`);
                res.render('pages/index', {
                    path: redirectTo,
                    warning: 'User with this E-Mail already exists',
                });
                return;
            }
            let OTP = (0, helpers_1.OTPGenerator)();
            let { found: blankUserExists } = await (0, helpers_1.findUser)(userId);
            if (blankUserExists && (0, helpers_1.isJKLUEmail)(email) && name !== '') {
                let user = dataStore_1.users[userId];
                if (!user) {
                    logger.info(`The user was not found in data store ${JSON.stringify(dataStore_1.users)}`);
                    res.render('pages/notfound');
                    return;
                }
                let newUser = Object.assign(Object.assign({}, user), { OTP, email, name });
                dataStore_1.users[userId] = newUser;
                let sent = await (0, helpers_1.sendMail)(email, (0, helpers_1.generateEmail)(OTP));
                logger.info(`Sent E-Mail to ${user.name}:${userId}`);
                if (!sent)
                    return;
                res.redirect(`/complete/${userId}`);
            }
            else {
                res.render('pages/notfound');
            }
        }
        catch (error) {
            logger.error(error.message);
        }
    })();
});
app.get('/complete/:id', function (req, res) {
    ;
    (async function () {
        try {
            let userId = req.params.id;
            let { found: userExists } = await (0, helpers_1.findUser)(userId);
            if (userExists) {
                logger.info(`User ${userId} redirected to otp as they exist`);
                res.render('pages/otp', { path: `/give-role/${userId}` });
            }
            else {
                logger.info(`User ${userId} not found after sending mail`);
                res.render('pages/notfound');
            }
        }
        catch (error) {
            logger.error(error.message);
        }
    })();
});
let mapp = {
    hr: 'HR',
    dh: 'Design Head',
    hw: 'Hard Working',
    success: 'Successful',
    hot: 'Hot',
    caring: 'Caring',
    cute: 'Cute',
    dashing: 'Dashing',
};
function mapValues(roles) {
    let roless = [];
    for (let role of roles) {
        roless.push(mapp[role]);
    }
    return roless;
}
app.post('/give-role/:id', function (req, res) {
    ;
    (async function () {
        try {
            let userId = req.params.id;
            let { found: userExists, user } = await (0, helpers_1.findUser)(userId);
            let inputOTP = (0, helpers_1.buildOTPString)(req.body);
            if (userExists && inputOTP == user.OTP) {
                logger.info(`${userId} has entered correct OTP and exists in data store`);
                await (0, helpers_1.assignRole)(user, 'Holy Grail', mapValues(dataStore_1.users[userId].roles));
                logger.info(`The user:${userId} has been assigned their respective roles`);
                delete dataStore_1.users[userId];
                logger.info(`The user ${user} is deleted from DB, data store: ${JSON.stringify(dataStore_1.users)}`);
                res.render('pages/success');
            }
            else {
                logger.error(`${userId} either does not exist or entered wrong OTP, data store: ${JSON.stringify(dataStore_1.users)}, entered OTP was: ${inputOTP}`);
                res.render('pages/notfound');
            }
        }
        catch (error) {
            logger.error(error.message);
        }
    })();
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, function () {
    ;
    (async function () {
        client_1.client.login(process.env.DISCORDJS_BOT_TOKEN);
        console.log('server is running');
    })();
});
//# sourceMappingURL=bot.js.map