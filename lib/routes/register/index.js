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
            {
              audience: options.security.jwtIssuer,
              expiresIn: options.security.refreshTokenExpiry,
              issuer: options.security.jwtIssuer
            }
          ),
          token: server.jwt.sign(
            { id },
            {
              audience: options.security.jwtIssuer,
              expiresIn: `${options.security.tokenLifetime}m`,
              issuer: options.security.jwtIssuer
            }
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
          {
            audience: options.security.jwtIssuer,
            expiresIn: `${options.security.tokenLifetime}m`,
            issuer: options.security.jwtIssuer
          }
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
