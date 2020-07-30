const fp = require('fastify-plugin')

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
