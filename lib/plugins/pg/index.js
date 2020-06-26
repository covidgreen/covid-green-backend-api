require('pg-range').install(require('pg'))
const fp = require('fastify-plugin')
const pg = require('fastify-postgres')

async function plugin(server, options) {
  server.register(pg, {
    ...options.pgPlugin.config,
    host: options.pgPlugin.read,
    name: 'read'
  })

  server.register(pg, {
    ...options.pgPlugin.config,
    host: options.pgPlugin.write,
    name: 'write'
  })
}

module.exports = fp(plugin)
