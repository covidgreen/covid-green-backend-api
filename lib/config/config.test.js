jest.mock('aws-sdk')

const { SecretsManager, SSM } = require('aws-sdk')
const faker = require('faker')
const getConfig = require('.')

SecretsManager.mockImplementation(() => ({
  getSecretValue: () => ({
    promise: () =>
      Promise.resolve({
        SecretString: JSON.stringify({})
      })
  })
}))

SSM.mockImplementation(() => ({
  getParameter: ({ Name }) => ({
    promise: () =>
      Promise.resolve({
        Parameter: {
          Value: Name === 'metrics_config' ? '{}' : Name
        }
      })
  })
}))

describe('configuration', () => {
  const currentEnv = Object.assign({}, process.env)

  beforeAll(() => {
    jest.resetModules()
  })

  afterEach(() => {
    // restore previous environment, and reset configuration
    jest.resetModules()
    Object.assign(process.env, currentEnv)
  })

  it('returns values according to environment variables', async () => {
    const metricsConfig = { METRIC_TEST: faker.random.number() }

    const NODE_ENV = 'development'
    const CONFIG_VAR_PREFIX = ''
    const API_HOST = faker.internet.ip()
    const API_PORT = faker.random.number()
    const CORS_ORIGIN = faker.random.boolean()
    const DB_HOST = faker.lorem.word()
    const DB_READ_HOST = faker.lorem.word()
    const DB_PORT = faker.random.number()
    const DB_USER = faker.lorem.word()
    const DB_PASSWORD = faker.lorem.word()
    const DB_DATABASE = faker.lorem.word()
    const DB_SSL = faker.random.boolean()
    const LOG_LEVEL = faker.random.arrayElement(['debug', 'warn', 'silent'])
    const AWS_ACCESS_KEY_ID = faker.lorem.word()
    const AWS_SECRET_ACCESS_KEY = faker.lorem.word()
    const AWS_REGION = faker.lorem.word()
    const ENCRYPT_KEY = faker.lorem.word()
    const JWT_SECRET = faker.lorem.word()
    const CODE_LIFETIME_MINS = faker.random.number()
    const TOKEN_LIFETIME_MINS = faker.random.number()
    const VERIFY_RATE_LIMIT_SECS = faker.random.number()
    const EXPOSURE_LIMIT = faker.random.number()
    const CALLBACK_QUEUE_URL = faker.lorem.word()
    const ASSETS_BUCKET = faker.lorem.word()
    const METRICS_CONFIG = JSON.stringify(metricsConfig)

    Object.assign(process.env, {
      NODE_ENV,
      CONFIG_VAR_PREFIX,
      API_HOST,
      API_PORT,
      CORS_ORIGIN,
      DB_HOST,
      DB_READ_HOST,
      DB_PORT,
      DB_USER,
      DB_PASSWORD,
      DB_DATABASE,
      DB_SSL,
      LOG_LEVEL,
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      AWS_REGION,
      ENCRYPT_KEY,
      JWT_SECRET,
      CODE_LIFETIME_MINS,
      TOKEN_LIFETIME_MINS,
      VERIFY_RATE_LIMIT_SECS,
      EXPOSURE_LIMIT,
      CALLBACK_QUEUE_URL,
      ASSETS_BUCKET,
      METRICS_CONFIG
    })

    const config = await getConfig()

    expect(config.isProduction).toEqual(false)

    expect(config.fastify).toEqual({
      host: API_HOST,
      port: API_PORT
    })

    expect(config.fastifyInit.logger).toEqual({
      level: LOG_LEVEL
    })

    expect(config.cors).toEqual({
      origin: CORS_ORIGIN
    })

    expect(config.pgPlugin).toEqual({
      read: DB_READ_HOST,
      write: DB_HOST,
      config: {
        port: DB_PORT,
        ssl: DB_SSL,
        database: DB_DATABASE,
        user: DB_USER,
        password: DB_PASSWORD
      }
    })

    expect(config.security).toEqual({
      codeLifetime: CODE_LIFETIME_MINS,
      encryptKey: ENCRYPT_KEY,
      tokenLifetime: TOKEN_LIFETIME_MINS,
      verifyRateLimit: VERIFY_RATE_LIMIT_SECS,
      jwtSecret: JWT_SECRET
    })

    expect(config.exposures).toEqual({
      limit: EXPOSURE_LIMIT
    })

    expect(config.aws).toEqual({
      assetsBucket: ASSETS_BUCKET,
      callbackQueueUrl: CALLBACK_QUEUE_URL
    })

    expect(config.metrics).toEqual(metricsConfig)
  })

  it('loads config from aws in production', async () => {
    process.env.NODE_ENV = 'production'

    const config = await getConfig()

    expect(config.isProduction).toEqual(true)

    expect(config.fastify).toEqual(
      expect.objectContaining({
        host: 'api_host'
      })
    )

    expect(config.fastifyInit.logger).toEqual({
      level: 'log_level'
    })

    expect(config.pgPlugin).toEqual(
      expect.objectContaining({
        read: 'db_reader_host',
        write: 'db_host'
      })
    )

    expect(config.aws).toEqual({
      assetsBucket: 's3_assets_bucket',
      callbackQueueUrl: 'callback_url'
    })
  })
})
