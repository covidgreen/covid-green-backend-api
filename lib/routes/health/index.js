const { version } = require('../../../package')
const fp = require('fastify-plugin')
async function health(server, options, done) {
  server.register(require('under-pressure'), options.underPressure)

  server.route({
    method: 'GET',
    url: '/healthcheck',
    handler: async () => {
      return {
        version,
        serverTimestamp: new Date(),
        status: 'ok',
        memoryUsage: server.memoryUsage(),
        db: 'ok'
      }
    }
  })

  done()
}

module.exports = fp(health)
