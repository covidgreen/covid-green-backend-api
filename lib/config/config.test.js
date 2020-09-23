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
          Value: Name.includes('metrics_config') ? '{}' : Name
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
    const DB_POOL_SIZE = faker.random.number()
    const LOG_LEVEL = faker.random.arrayElement(['debug', 'warn', 'silent'])
    const AWS_ACCESS_KEY_ID = faker.lorem.word()
    const AWS_SECRET_ACCESS_KEY = faker.lorem.word()
    const AWS_REGION = faker.lorem.word()
    const DEFAULT_REGION = faker.lorem.word()
    const ENCRYPT_KEY = faker.lorem.word()
    const JWT_ISSUER = faker.lorem.word()
    const JWT_SECRET = faker.lorem.word()
    const REFRESH_TOKEN_EXPIRY = faker.lorem.word()
    const CODE_LIFETIME_MINS = faker.random.number()
    const TOKEN_LIFETIME_MINS = faker.random.number()
    const UPLOAD_MAX_KEYS = faker.random.number()
    const UPLOAD_TOKEN_LIFETIME_MINS = faker.random.number()
    const VERIFY_RATE_LIMIT_SECS = faker.random.number()
    const CALLBACK_RATE_LIMIT_SECS = faker.random.number()
    const CALLBACK_RATE_LIMIT_REQUEST_COUNT = faker.random.number()
    const CALLBACK_QUEUE_URL = faker.lorem.word()
    const ASSETS_BUCKET = faker.lorem.word()
    const METRICS_CONFIG = JSON.stringify(metricsConfig)
    const CERTIFICATE_AUDIENCE = faker.lorem.word()
    const HSTS_MAX_AGE = faker.random.number()

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
      DB_POOL_SIZE,
      LOG_LEVEL,
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      AWS_REGION,
      DEFAULT_REGION,
      ENCRYPT_KEY,
      JWT_ISSUER,
      JWT_SECRET,
      REFRESH_TOKEN_EXPIRY,
      CODE_LIFETIME_MINS,
      TOKEN_LIFETIME_MINS,
      UPLOAD_MAX_KEYS,
      UPLOAD_TOKEN_LIFETIME_MINS,
      VERIFY_RATE_LIMIT_SECS,
      CALLBACK_QUEUE_URL,
      ASSETS_BUCKET,
      METRICS_CONFIG,
      CERTIFICATE_AUDIENCE,
      CALLBACK_RATE_LIMIT_SECS,
      CALLBACK_RATE_LIMIT_REQUEST_COUNT,
      HSTS_MAX_AGE
    })

    const config = await getConfig()

    expect(config.isProduction).toEqual(false)

    expect(config.fastify).toEqual({
      host: API_HOST,
      port: API_PORT
    })

    expect(config.fastifyInit.logger).toEqual(
      expect.objectContaining({
        level: LOG_LEVEL
      })
    )

    expect(config.cors).toEqual({
      origin: CORS_ORIGIN
    })

    expect(config.pgPlugin).toEqual({
      read: DB_READ_HOST,
      write: DB_HOST,
      config: {
        port: DB_PORT,
        database: DB_DATABASE,
        user: DB_USER,
        password: DB_PASSWORD,
        ssl: DB_SSL ? { rejectUnauthorized: false } : false,
        max: DB_POOL_SIZE
      }
    })

    expect(config.security).toEqual({
      refreshTokenExpiry: REFRESH_TOKEN_EXPIRY,
      codeLifetime: CODE_LIFETIME_MINS,
      encryptKey: ENCRYPT_KEY,
      tokenLifetime: TOKEN_LIFETIME_MINS,
      verifyRateLimit: VERIFY_RATE_LIMIT_SECS,
      jwtIssuer: JWT_ISSUER,
      jwtSecret: JWT_SECRET,
      callbackRateLimitSeconds: CALLBACK_RATE_LIMIT_SECS,
      callbackRateLimitRequestCount: CALLBACK_RATE_LIMIT_REQUEST_COUNT,
      hstsMaxAge: HSTS_MAX_AGE
    })

    expect(config.exposures).toEqual({
      certificateAudience: CERTIFICATE_AUDIENCE,
      defaultRegion: DEFAULT_REGION,
      maxKeys: UPLOAD_MAX_KEYS,
      tokenLifetime: UPLOAD_TOKEN_LIFETIME_MINS
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

    expect(config.fastifyInit.logger).toEqual(
      expect.objectContaining({
        level: 'log_level'
      })
    )

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
