require('dotenv').config()
import express from 'express'
import { client } from './client'
import { __prod__ } from './constants'
import {
    assignRole,
    buildOTPString,
    doesUserAlreadyExists,
    encodeUserId,
    findUser,
    generateEmail,
    initializeUser,
    isJKLUEmail,
    OTPGenerator,
    sendDM,
    sendMail,
} from './helpers'
import { User } from './types'
import pino from 'pino'
import { users } from './dataStore'
const TinyURL = require('tinyurl')

const app = express()
const logger = pino({ prettifier: true, prettyPrint: { colorize: true } })

// ==================
//    Middlewares
// ==================
app.set('view engine', 'ejs')
app.use(express.urlencoded({ extended: false }))
app.use(express.static(__dirname + '/../public'))

let indexPageParams = {
    path: '',
    warning: '',
}

client.on('ready', function () {
    if (client.user) {
        logger.info(`${client.user.username} is now active`)
    } else {
        logger.error('Client is not ready at the moment')
    }
})

// runs the function as soon as a new member
// enters the server.
client.on('guildMemberAdd', function (member) {
    ;(async function () {
        try {
            let userId = member.user.id
            userId = encodeUserId(userId)

            // creating a new user in database
            let user = initializeUser(userId)
            users[userId] = user

            logger.info(`Initialized a new user: ${member.user.username}`)

            // send the verfication link through a DM from bot
            let url = __prod__
                ? `https://polar-citadel-65410.herokuapp.com/verify/${userId}`
                : `http://localhost:4000/verify/${userId}`

            let shortURL = await TinyURL.shorten(url)
            await sendDM(userId, `Please verify your account at ${shortURL}`)
            logger.info(`sent DM to ${member.user.username}`)
        } catch (error) {
            logger.error(error.message)
        }
    })()
})

client.on('guildMemberRemove', (member) => {
    ;(async () => {
        let userLeft = member.user
        let userId = null

        if (userLeft) {
            userId = userLeft.id
            delete users[encodeUserId(userId)]
            logger.info(`Removed ${userLeft.username} from server`)
            return
        }

        logger.error('Not able to get user from discord')
    })()
})

var getRandNumWithLimit = function (min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min

    // randomise the range (max - min) and add to minimum
}

const links = ['https://discord.gg/kfY7jqbcvu', 'https://discord.gg/V4vxB5EH4Q']

// https://discord.gg/kfY7jqbcvu

app.get('/join', function (_, res) {
    ;(async () => {
        logger.info(`Join server page hit`)
        res.render('pages/getlink', { link: links[getRandNumWithLimit(0, 1)] })
    })()
})

app.get('/', function (_, res) {
    ;(async () => {
        logger.info(`Join server page hit`)
        // res.render('pages/getlink', { link: links[getRandNumWithLimit(0, 1)] })
        res.render('pages/index', indexPageParams)
    })()
})

app.get('/:anything', function (_, res) {
    res.render('pages/notfound', {})
})

// the first page that open up, asking for email and name
// of user.
app.get('/verify/:userId/:error?', function (req, res) {
    ;(async function () {
        let { userId, error } = req.params
        let redirectTo = `/auth/${userId}`

        let { found: userExists } = await findUser(userId)

        // in case the user is already verified, take him to success page
        if (userExists && !error) {
            logger.info(`${userId} is looking at the form`)
            res.render('pages/index', {
                ...indexPageParams,
                path: redirectTo,
            })
        } else if (error === 'true') {
            logger.info(`${userId} entered an undesired email address`)
            res.render('pages/index', {
                path: redirectTo,
                warning: 'Enter JKLU E-Mail address only',
            })
        } else {
            logger.error('IDK wtf the user was trying to do')
            res.render('pages/notfound')
        }
    })()
})

// processing entered email and name, and validating user info
app.post('/auth/:userId', function (req, res) {
    ;(async function () {
        try {
            let { email, name } = req.body

            let userId = req.params.userId
            logger.info(`Processing ${userId}'s entered details'`)

            if (typeof req.body.role === 'string') {
                // @ts-ignore
                users[userId].roles = [req.body.role]
            } else {
                users[userId].roles = req.body.role
            }

            logger.info(`The roles chosen are ${JSON.stringify(req.body.role)}`)
            let redirectTo = `/auth/${userId}`

            // check if the user with the entred email already exists
            let userAlreadyExists = await doesUserAlreadyExists(email)
            if (userAlreadyExists) {
                logger.info(
                    `The user: ${userId} already existed, data store: ${JSON.stringify(
                        users,
                    )}`,
                )
                res.render('pages/index', {
                    path: redirectTo,
                    warning: 'User with this E-Mail already exists',
                })
                return
            }

            //If the user is being added for the first time
            let OTP = OTPGenerator()
            let { found: blankUserExists } = await findUser(userId)

            if (blankUserExists && isJKLUEmail(email) && name !== '') {
                // get the blank user object
                let user = users[userId]
                if (!user) {
                    logger.info(
                        `The user was not found in data store ${JSON.stringify(
                            users,
                        )}`,
                    )
                    res.render('pages/notfound')
                    return
                }

                // add data to it
                let newUser: User = { ...user, OTP, email, name }
                users[userId] = newUser

                // send an email with the OTP
                let sent = await sendMail(email, generateEmail(OTP))
                logger.info(`Sent E-Mail to ${user.name}:${userId}`)
                if (!sent) return
                res.redirect(`/complete/${userId}`)
            } else {
                res.render('pages/notfound')
            }
        } catch (error) {
            logger.error(error.message)
        }
    })()
})

app.get('/complete/:id', function (req, res) {
    ;(async function () {
        try {
            let userId = req.params.id

            let { found: userExists } = await findUser(userId)

            if (userExists) {
                logger.info(`User ${userId} redirected to otp as they exist`)
                res.render('pages/otp', { path: `/give-role/${userId}` })
            } else {
                logger.info(`User ${userId} not found after sending mail`)
                res.render('pages/notfound')
            }
        } catch (error) {
            logger.error(error.message)
        }
    })()
})

let mapp: Record<string, string> = {
    hr: 'HR',
    dh: 'Design Head',
    hw: 'Hard Working',
    success: 'Successful',
    hot: 'Hot',
    caring: 'Caring',
    cute: 'Cute',
    dashing: 'Dashing',
}

function mapValues(roles: Array<string>) {
    let roless: Array<string> = []

    for (let role of roles) {
        roless.push(mapp[role])
    }

    return roless
}

app.post('/give-role/:id', function (req, res) {
    ;(async function () {
        try {
            let userId = req.params.id

            let { found: userExists, user } = await findUser(userId)

            let inputOTP = buildOTPString(req.body)

            // if the user is found and OTP matches, then we assign him/ her
            // their respective role, set their nickname and send them DM,
            // about the updated changes.
            if (userExists && inputOTP == (user as User).OTP) {
                logger.info(
                    `${userId} has entered correct OTP and exists in data store`,
                )
                await assignRole(
                    user as User,
                    'Holy Grail',
                    // @ts-ignore
                    mapValues(users[userId].roles),
                )

                logger.info(
                    `The user:${userId} has been assigned their respective roles`,
                )

                // once the user is assigned his/ her role, save his status
                delete users[userId]
                logger.info(
                    `The user ${user} is deleted from DB, data store: ${JSON.stringify(
                        users,
                    )}`,
                )
                res.render('pages/success')
            } else {
                logger.error(
                    `${userId} either does not exist or entered wrong OTP, data store: ${JSON.stringify(
                        users,
                    )}, entered OTP was: ${inputOTP}`,
                )
                res.render('pages/notfound')
            }
        } catch (error) {
            logger.error(error.message)
        }
    })()
})

const PORT = process.env.PORT || 4000

app.listen(PORT, function () {
    ;(async function () {
        client.login(process.env.DISCORDJS_BOT_TOKEN)
        console.log('server is running')
    })()
})
