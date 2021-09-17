import { Role } from 'discord.js'
import nodemailer from 'nodemailer'
import { client } from './client'
import { users } from './dataStore'
import { User, UserResponse } from './types'

let transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST as string,
    port: Number(process.env.SMTP_PORT as string),
    secure: false,
    auth: {
        user: process.env.SENDERS_EMAIL,
        pass: process.env.SENDERS_EMAIL_PASSWORD,
    },
})

export async function sendMail(
    to: string,
    content: string,
    from = process.env.SENDERS_EMAIL as string,
) {
    let sent = false

    const msg = {
        to,
        from,
        subject: 'Verification for JKLU discord server',
        text: 'Join the best discord server ever',
        html: content,
    }

    try {
        const mail = await transporter.sendMail(msg)
        if (mail.accepted.includes(to)) {
            sent = true
        }
    } catch {
        sent = false
    }

    return sent
}

export async function sendDM(userId: string, message: string, force = true) {
    if (userId.includes('disuser:')) {
        userId = decodeUserId(userId)
    }
    const user = await client.users.fetch(userId, {
        force,
    })
    await user.send(message)
}

export function isJKLUEmail(email: string) {
    let idx = email.indexOf('@')
    return email.substr(idx, email.length) === '@jklu.edu.in'
}

export async function asyncCallAll(...fns: (() => Promise<any>)[]) {
    for (let fn of fns) {
        await fn()
    }
}

export function callAll(...fns: (() => any)[]) {
    fns.forEach((fn) => fn())
}

export function dataIterator(container: string) {
    let idx = -1
    return next

    function next() {
        idx = idx + 1
        return container[idx]
    }
}

export function OTPGenerator(): string {
    return Math.random().toString().substr(2, 6)
}

export function initializeUser(userId: string) {
    let user: User = {
        userId,
        name: '',
        OTP: '',
        email: '',
        verified: false,
    }
    return user
}

export function encodeUserId(userId: string) {
    return `disuser:${userId}`
}

export function decodeUserId(userId: string) {
    return userId.substr(8, userId.length)
}

/**
 * checks if the user exists or not
 * @param userId discord ID of user
 * @returns boolean
 */
export async function findUser(userId: string): Promise<UserResponse> {
    let user = users[userId]
    if (!user) return { error: 'User not found', found: false, user: null }
    return { error: null, found: true, user }
}

export function buildOTPString(body: any) {
    let inputOTP = ''
    for (let key of Object.keys(body)) {
        inputOTP = inputOTP.concat(body[key])
    }
    return inputOTP
}

export async function assignRole(
    user: User,
    serverName: string,
    roleNames: Array<string>,
) {
    let guild = client.guilds.cache.find((guild) => guild.name === serverName)
    if (!guild) return

    let userId = decodeUserId(user.userId)

    try {
        let roles: Array<Role | undefined> = []
        for (let roleName of roleNames) {
            let role = guild.roles.cache.find((r) => r.name === roleName)
            if (!role) return
            roles.push(role)
        }

        let member = await guild.members.fetch(userId)

        await asyncCallAll(addRole, setNickame, sendDMAsync)

        async function addRole() {
            for (let role of roles) {
                await member.roles.add(role as Role)
            }
        }

        async function setNickame() {
            await member.setNickname((user as User).name)
        }

        async function sendDMAsync() {
            let names = ''
            for (let roleName of roleNames) {
                names = names + roleName + ', '
            }
            await sendDM(
                userId,
                `You have been assigned the following roles ${names}`,
            )
        }
    } catch (error) {
        await sendDM(userId, 'Oops! An error occured')
    }
}

export async function doesUserAlreadyExists(email: string) {
    let userAlreadyExists = false
    let userKeys = Object.keys(users)

    for (let id of userKeys) {
        let user = users[id]
        if (!user) break
        if (user.email === email) userAlreadyExists = true
    }

    return userAlreadyExists
}

export function generateEmail(OTP: string) {
    return `
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>JKLU's Discord Server</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            img {
                width: 100px;
                margin: 10px;
            }

            .images {
                display: flex;
                align-items: center;
            }

            .seperator {
                height: 100px;
                border-right: 1px solid rgb(208, 208, 208);
                margin: 0 15px;
            }
        </style>
    </head>
    <body>
        <div>
            <h1>Join JKLU's Discord server</h1>
            <p>Here we will put some details about our server</p>
            <div class="images">
                <img src="https://i.ibb.co/qB2g4k0/discord.png" alt="" />
                <span class="seperator"></span>
                <img src="https://i.ibb.co/XsT6m9M/jklu.png" alt="" />
            </div>

            <h2>Please use the OTP below to verify your account</h2>
            <h3>OTP: ${OTP}</h3>
            <br />
            <p>Thanks, for joining our server</p>
        </div>
    </body>
</html>
    `
}
