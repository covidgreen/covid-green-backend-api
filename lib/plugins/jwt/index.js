const fp = require('fastify-plugin')
const { Unauthorized } = require('http-errors')

async function jwt(server, options) {
  function authenticate() {
    try {
      const data = server.jwt.verify(
        this.headers.authorization.replace(/^Bearer /, '')
      )

      if (data.refresh) {
        throw new Error()
      }

      // this.log.info({ data }, 'authorised user')

      return data
    } catch (err) {
      this.log.info({ err }, 'error verifying jwt')

      throw new Unauthorized()
    }
  }

  server.register(require('fastify-jwt'), {
    secret: options.security.jwtSecret
  })
  server.decorateRequest('authenticate', authenticate)
}

module.exports = fp(jwt)
