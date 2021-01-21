const crypto = require('crypto')
const fp = require('fastify-plugin')
const jwt = require('jsonwebtoken')
const schema = require('./schema')
const util = require('util')
const AWS = require('aws-sdk')
const { differenceInMinutes } = require('date-fns')
const { Forbidden, Gone, NotFound, Unauthorized } = require('http-errors')
const {
  checkInInsert,
  emailAddressInsert,
  emailAddressSelect,
  emailAddressDelete,
  riskyVenueSelect,
  tokenUpdate,
  typesSelect,
  venueInsert
} = require('./query')
const { metricsInsert } = require('../metrics/query')

const randomBytes = util.promisify(crypto.randomBytes)

async function qrCode(server, options) {
  if (!options.routes.qr) {
    server.log.info('Venue Endpoints: Off')
    return
  }

  server.log.info('Venue Endpoints: On')

  const ses = new AWS.SES({ region: process.env.AWS_REGION })
  const sqs = new AWS.SQS({ region: process.env.AWS_REGION })

  const encrypt = async value => {
    const key = Buffer.from(options.security.encryptKey)
    const iv = await randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    const buffer = cipher.update(value.toString())
    const encrypted = Buffer.concat([buffer, cipher.final()])

    return `${iv.toString('hex')}${encrypted.toString('hex')}`
  }

  const decrypt = mobile => {
    const key = Buffer.from(options.security.encryptKey)
    const iv = Buffer.from(mobile.substr(0, 32), 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    const buffer = decipher.update(mobile.substr(32), 'hex')

    return Buffer.concat([buffer, decipher.final()]).toString()
  }

  function verifyEmailAddressJwt(receiverEmail) {
    return new Promise((resolve, reject) => {
      jwt.verify(
        receiverEmail,
        options.qr.secret,
        {
          algorithms: ['ES256'],
          subject: 'emailAddress'
        },
        (err, data) => {
          if (err) {
            server.log.error(err)
            return reject(new Unauthorized('Bad Token'))
          }

          resolve(data.emailAddress)
        }
      )
    })
  }

  server.route({
    method: 'POST',
    url: '/email',
    schema: schema.email,
    handler: async (request, response) => {
      const { emailAddress } = request.body
      const verificationCode = Math.floor(100000 + Math.random() * 900000)

      await server.pg.write.query(
        emailAddressInsert({
          emailAddress: await encrypt(emailAddress),
          verificationCode
        })
      )

      const body = {
        Destination: {
          ToAddresses: [emailAddress]
        },
        Message: {
          Body: {
            Text: {
              Data: `Your verification code is ${verificationCode}`
            }
          },

          Subject: {
            Data: `Here is your verification code`
          }
        },
        Source: 'nfcs-dev-no-reply@nf-covid-services.com'
      }

      await ses.sendEmail(body).promise()

      response.status(204)
    }
  })

  server.route({
    method: 'PUT',
    url: '/email',
    schema: schema.verify,
    handler: async request => {
      const { emailAddress, verificationCode } = request.body

      const { rowCount, rows } = await server.pg.write.query(
        emailAddressSelect({
          verificationCode,
          lifetime: options.qr.emailAddressVerifyLifetime
        })
      )

      if (rowCount === 0) {
        throw new NotFound('Invalid or expired verificationCode')
      }

      const [{ id, encryptedEmail }] = rows

      if (emailAddress !== decrypt(encryptedEmail)) {
        throw new NotFound('Email address does not match')
      }

      const token = jwt.sign({ emailAddress }, options.qr.secret, {
        algorithm: 'ES256',
        expiresIn: `${options.qr.emailAddressVerifyLifetime}m`,
        subject: 'emailAddress'
      })

      await server.pg.write.query(emailAddressDelete({ id }))

      return { token }
    }
  })

  server.route({
    method: 'GET',
    url: '/venues/types',
    schema: schema.types,
    handler: async () => {
      const { rows } = await server.pg.read.query(typesSelect())

      return {
        venueTypes: rows
      }
    }
  })

  server.route({
    method: 'POST',
    url: '/venues',
    schema: schema.create,
    handler: async (request, response) => {
      const {
        receiverEmail,
        receiverFirstName,
        venueType,
        venueName,
        venueAddress,
        venueLocation,
        contactEmail,
        contactPhone
      } = request.body

      const emailAddress = await verifyEmailAddressJwt(receiverEmail)

      const {
        rows: [{ id }]
      } = await server.pg.write.query(
        venueInsert({
          venueType,
          venueName,
          venueAddress,
          venueLocation,
          contactEmail: await encrypt(contactEmail),
          contactPhone: await encrypt(contactPhone)
        })
      )

      if (options.qr.generateQueueUrl) {
        const body = {
          token: jwt.sign(
            { id, venueName, venueAddress, version: 1 },
            options.qr.secret,
            {
              algorithm: 'ES256'
            }
          ),
          emailAddress,
          id,
          name: venueName,
          location: venueAddress,
          receiverName: receiverFirstName
        }

        const message = {
          QueueUrl: options.qr.generateQueueUrl,
          MessageBody: JSON.stringify(body)
        }

        await sqs.sendMessage(message).promise()
      }

      response.status(204)
    }
  })

  server.route({
    method: 'GET',
    url: '/venues/risky',
    schema: schema.risky,
    handler: async () => {
      const { rows } = await server.pg.read.query(riskyVenueSelect())

      return {
        riskyVenues: rows
      }
    }
  })

  server.route({
    method: 'POST',
    url: '/venues/check-ins',
    schema: schema.upload,
    handler: async (request, response) => {
      const { id } = request.authenticate()
      const { platform, token, venues } = request.body

      await request.verify(token.replace(/-/g, ''))

      const { rows } = await server.pg.write.query(tokenUpdate({ id, token }))

      if (rows.length === 0) {
        throw new Forbidden()
      }

      const [{ createdAt }] = rows

      if (
        differenceInMinutes(new Date(), new Date(createdAt)) >
        options.exposures.tokenLifetime
      ) {
        throw new Gone()
      }

      if (venues.length > 0) {
        for (const { id, date } of venues) {
          const message = {
            QueueUrl: options.qr.alertQueueUrl,
            MessageBody: JSON.stringify({ id, date })
          }

          await sqs.sendMessage(message).promise()
        }

        await server.pg.write.query(checkInInsert({ venues }))

        await server.pg.write.query(
          metricsInsert({
            event: 'VENUE_CHECK_IN_UPLOAD',
            os: platform,
            version: '',
            timeZone: options.timeZone
          })
        )
      }

      response.status(204)
    }
  })
}

module.exports = fp(qrCode)
