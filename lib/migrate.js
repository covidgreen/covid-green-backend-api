const path = require('path')
const Postgrator = require('postgrator')
const getConfig = require('./config')

function getPostgratorInstance(config) {
  return new Postgrator({
    migrationDirectory: path.join(__dirname, '../migrations'),
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

/**
 * Run all .sql scripts inside the ./migrations folder. This will run the scripts
 * in order to apply all the scripts to the database. It takes into account any
 * scripts that may have already been run against the database.
 *
 * Note that issues have been seen around line
 *   await postgrator.migrate()
 * which can cause the process to exit without a proper error. We've seen this
 * occur if the node version is 14.x. Node 12.x is known to work.
 *
 * @returns {Promise<void>}
 */
async function migrateSchema() {
  try {
    const config = await getConfig()
    const postgrator = getPostgratorInstance(config)
    const result = await postgrator.migrate()

    if (result.length === 0) {
      console.log(
        'No migrations run for schema "public". Already at the latest one.'
      )
    }

    console.log('Migration done.')

    // Likely unnecessary, but just to be thorough...
    process.exitCode = 0
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}

if (require.main === module) {
  migrateSchema()
}

module.exports = { getPostgratorInstance, migrateSchema }
