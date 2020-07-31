const startServer = require('./lib/server')
const getConfig = require('./lib/config')
const { getPostgratorInstance } = require('./lib/migrate')

const main = async () => {
  process.on('unhandledRejection', err => {
    console.error(err)
    process.exit(1)
  })

  const config = await getConfig()
  const postgrator = getPostgratorInstance(config)

  // Confirm that all database migration files have been applied to the database
  // instance we are connecting to. If not, don't allow the service to start.
  const expectedVersion = await postgrator.getMaxVersion()
  const currentVersion = await postgrator.getDatabaseVersion()

  if (currentVersion !== expectedVersion) {
    console.error(
      `expected version ${expectedVersion}, but db is at version ${currentVersion}`
    )
    process.exit(1)
  }

  const server = require('fastify')(config.fastifyInit)
  server.register(startServer, config)

  const address = await server.listen(config.fastify)
  server.log.info(`Server running at: ${address}`)

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () =>
      server.close().then(err => {
        console.log(`close application on ${signal}`)
        process.exit(err ? 1 : 0)
      })
    )
  }
}

main()
