const crypto = require('crypto')
const fp = require('fastify-plugin')
const schema = require('./schema')
const util = require('util')
const {
  refreshSelect,
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

      return { nonce }
    }
  })

  server.route({
    method: 'PUT',
    url: '/register',
    schema: schema.verify,
    handler: async request => {
      const { nonce } = request.body
      const { rowCount, rows } = await server.pg.read.query(
        registerSelect({ nonce })
      )

      if (rowCount === 0) {
        throw new NotFound('Invalid or expired nonce')
      }

      const [{ id }] = rows

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
        refreshToken: server.jwt.sign({ id, refresh }, { expiresIn: '1y' }),
        token: server.jwt.sign(
          { id },
          { expiresIn: `${options.security.tokenLifetime}m` }
        )
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
    schema: schema.forrget,
    handler: async (request, response) => {
      const { id } = request.authenticate()

      await server.pg.write.query(registerDelete({ id }))

      response.status(204)
    }
  })

  done()
}

module.exports = fp(register)
