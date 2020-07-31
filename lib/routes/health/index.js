const fp = require('fastify-plugin')

/**
 * This is a standard healthcheck endpoint. No authn/authz checks are performed and no user identifying information
 * is required.
 */
async function health(server, options, done) {
  server.route({
    method: 'GET',
    url: '/healthcheck',
    handler: async () => {
      return 'ok'
    }
  })

  done()
}

module.exports = fp(health)
