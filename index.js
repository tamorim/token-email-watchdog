'use strict'

const Imap = require('imap')
const ncp = require('copy-paste')
const notifier = require('node-notifier')
const fs = require('fs')
const os = require('os')

let optionsFile;
try {
  optionsFile = fs.readFileSync(`${os.homedir()}/.token-watchdog.json`)
} catch (e) {
  console.error('No .token-watchdog.json file found on the home directory ):')
  process.exit(1)
}

const imap = new Imap(JSON.parse(optionsFile))

const openInbox = () => {
  imap.openBox('INBOX', err => {
    if (err) throw err
  })
}

const copyToken = () => {
  imap.search(['UNSEEN', ['HEADER', 'FROM', '']], (err, data) => {
    if (err) throw err

    if (data.length === 0) return;

    const mail = data.pop();
    const f = imap.fetch(mail, { bodies: 'HEADER.FIELDS (SUBJECT)' })

    f.on('message', msg => {
      msg.on('body', stream => {
        let buffer = ''
        stream.on('data', chunk => buffer += chunk.toString())

        stream.once('end', () => {
          const token = buffer.match(/\d{6}/)[0]

          ncp.copy(token, () => {
            notifier.notify({
              title: 'Token E-mail Watchdog',
              message: `Copied token ${token} to the clipboard!`
            })

            imap.move(mail, '[Gmail]/Todos os e-mails', err => {
              if (err) throw err
            })
          })
        })
      })
    })

    f.once('error', err => console.log('Fetch error: ' + err))
  })
}

imap.once('ready', openInbox)
imap.on('mail', copyToken)
imap.once('error', err => console.log(err))
imap.once('end', () => process.exit())
imap.connect()

