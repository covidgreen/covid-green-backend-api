const Postgrator = require('postgrator')
const getConfig = require('./config')

function getPostgratorInstance(config) {
  return new Postgrator({
    driver: 'pg',
    host: config.pgPlugin.write,
    port: config.pgPlugin.config.port,
    database: config.pgPlugin.config.database,
    username: config.pgPlugin.config.user,
    password: config.pgPlugin.config.password,
    ssl: config.pgPlugin.config.ssl,
    schemaTable: 'migrations',
    currentSchema: 'public'
  })
}

async function isDatabaseReady() {
  try {
    const config = await getConfig()
    const postgrator = getPostgratorInstance(config)
    const version = await postgrator.getDatabaseVersion()

    console.log('Database is Ready: Version', version)
    return true
  } catch (error) {
    console.error(error)
    console.log('Database is not Ready')
    return false
  }
}

if (require.main === module) {
  isDatabaseReady().then(isReady => {
    process.exit(isReady ? 0 : 1)
  })
}

module.exports = { getPostgratorInstance, isDatabaseReady }
