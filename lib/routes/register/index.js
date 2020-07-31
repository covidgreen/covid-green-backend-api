const crypto = require('crypto')
const fp = require('fastify-plugin')
const schema = require('./schema')
const util = require('util')
const { metricsInsert } = require('../metrics/query')
const {
  refreshSelect,
  refreshUpdate,
  registerDelete,
  registerInsert,
  registerSelect,
  registerUpdate
} = require('./query')
const { NotFound, Unauthorized } = require('http-errors')

const randomBytes = util.promisify(crypto.randomBytes)

/**
 * Provides multiple endpoints to support App user registration. The initial registration is broken up
 * into two parts so that we can make use of standard Apple/Google device authentication
 *
 * Google: RNGoogleSafetyNet.sendAttestationRequestJWT(nonce, SAFETYNET_KEY)
 * Apple: RNIOS11DeviceCheck.getToken()
 *
 * First, a POST to /register is made with no data. This results in a new record being added to the
 * registrations table with a randomly generated ID (Postgres GEN_RANDOM_UUID()) and nonce (32 random
 * bytes) values. The nonce is returned to the caller.
 *
 * The caller is then able to use that nonce when calling the relevant Apple/Google device attestation
 * checks which will give them some deviceVerificationPayload.
 *
 * Second, a PUT to /register is made with the nonce and deviceVerificationPayload. The nonce is used to
 * lookup the user's record in the database, and the deviceVerificationPayload is verified. If both of
 * those checks pass then a random 32 byte HEX refresh string is generated, encrypted, and stored with the
 * user's database record. We then return to the caller a request token and a refresh token. The request
 * token contains the user's ID while the refresh token contains both the user's ID and the unencrypted
 * 32 byte HEX refresh string.
 *
 * The request token (called 'token') is included in requests from the App to the service, and is used
 * to identify the user. I'm not sure if the deviceVerificationPayload is also included in all requests.
 * The request token has a configurable TTL, defined in the .env file under TOKEN_LIFETIME_MINS. In
 * development this value is set as TOKEN_LIFETIME_MINS=60.
 *
 * The refresh token can be used to get a new request token. The refresh token has a configurable TTL,
 * defined in the .env file under REFRESH_TOKEN_EXPIRY. In development this value is set as
 * REFRESH_TOKEN_EXPIRY=10y. Notice that the refresh token TTL is much longer than the request token
 * TTL. This is to allow for refreshing after a request token has expired.
 *
 * At this point the user is registered with the system and can begin making standard service calls.
 *
 * A DELETE to /register can be used to delete a user's record. This allows the App to delete the
 * user's record upon App deletion, or as part of some other process. It gives users the ability to
 * delete their user record should they wish to.
 *
 * A POST to /refresh using the refresh token will result in a new valid request token. The ID in the
 * token is used to lookup the user record and if found, the refresh HEX string is compared against
 * the refresh HEX string stored in the database. (the database refresh HEX string is decrypted before
 * comparison). If the values match, and the refresh token has not expired, then a new request token
 * is generated and returned to the caller.
 */
async function register(server, options, done) {
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

  server.route({
    method: 'POST',
    url: '/register',
    schema: schema.register,
    handler: async () => {
      const nonce = (await randomBytes(32)).toString('hex')

      await server.pg.write.query(registerInsert({ nonce }))

      await server.pg.write.query(
        metricsInsert({
          event: 'REGISTER',
          os: '',
          version: ''
        })
      )

      return { nonce }
    }
  })

  server.route({
    method: 'PUT',
    url: '/register',
    schema: schema.verify,
    handler: async request => {
      const { nonce, platform } = request.body
      const { rowCount, rows } = await server.pg.read.query(
        registerSelect({ nonce })
      )

      if (rowCount === 0) {
        throw new NotFound('Invalid or expired nonce')
      }

      const [{ id }] = rows

      try {
        await request.verify(nonce)

        const refresh = (await randomBytes(32)).toString('hex')

        await server.pg.write.query(
          registerUpdate({
            id,
            refresh: await encrypt(refresh)
          })
        )

        request.log.info({ id }, 'registering user')

        return {
          refreshToken: server.jwt.sign(
            { id, refresh },
            { expiresIn: options.security.refreshTokenExpiry }
          ),
          token: server.jwt.sign(
            { id },
            { expiresIn: `${options.security.tokenLifetime}m` }
          )
        }
      } catch (error) {
        await server.pg.write.query(
          metricsInsert({
            event: 'REGISTER_FAIL',
            os: platform,
            version: ''
          })
        )

        throw error
      }
    }
  })

  server.route({
    method: 'POST',
    url: '/refresh',
    schema: schema.refresh,
    handler: async request => {
      let data

      try {
        data = server.jwt.verify(
          request.headers.authorization.replace(/^Bearer /, '')
        )

        if (!data.id || !data.refresh) {
          throw new Error()
        }
      } catch {
        throw new Unauthorized('Refresh token is missing')
      }

      const { id, refresh } = data
      const { rowCount, rows } = await server.pg.read.query(
        refreshSelect({ id })
      )

      if (rowCount === 0) {
        throw new Unauthorized('Refresh token is invalid')
      }

      const [{ refresh: encryptedRefresh }] = rows

      try {
        if (decrypt(encryptedRefresh) !== refresh) {
          throw new Error()
        }
      } catch {
        throw new Unauthorized('Refresh token has expired')
      }

      await server.pg.write.query(refreshUpdate({ id }))

      return {
        token: server.jwt.sign(
          { id },
          { expiresIn: `${options.security.tokenLifetime}m` }
        )
      }
    }
  })

  server.route({
    method: 'DELETE',
    url: '/register',
    schema: schema.forget,
    handler: async (request, response) => {
      const { id } = request.authenticate()

      await server.pg.write.query(registerDelete({ id }))

      response.status(204)
    }
  })

  done()
}

module.exports = fp(register)
