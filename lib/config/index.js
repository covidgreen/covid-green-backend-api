const envSchema = require('env-schema')
const S = require('fluent-schema')
const AWS = require('aws-sdk')
const { version } = require('../../package.json')

async function getConfig() {
  const env = envSchema({
    dotenv: true,
    schema: S.object()
      .prop('CONFIG_VAR_PREFIX', S.string())
      .prop('NODE_ENV', S.string())
      .prop('API_HOST', S.string())
      .prop('API_PORT', S.string())
      .prop('CORS_ORIGIN', S.string())
      .prop('DB_HOST', S.string())
      .prop('DB_READ_HOST', S.string())
      .prop('DB_PORT', S.string())
      .prop('DB_USER', S.string())
      .prop('DB_PASSWORD', S.string())
      .prop('DB_DATABASE', S.string())
      .prop('DB_SSL', S.boolean())
      .prop(
        'LOG_LEVEL',
        S.string()
          .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
          .default('info')
      )
      .prop('AWS_ACCESS_KEY_ID', S.string())
      .prop('AWS_SECRET_ACCESS_KEY', S.string())
      .prop('AWS_REGION', S.string())
      .prop('DEFAULT_REGION', S.string())
      .prop('ENCRYPT_KEY', S.string())
      .prop('EXPOSURE_LIMIT', S.number())
      .prop('JWT_SECRET', S.string())
      .prop('REFRESH_TOKEN_EXPIRY', S.string())
      .prop('TOKEN_LIFETIME_MINS', S.number())
      .prop('CODE_LIFETIME_MINS', S.number())
      .prop('UPLOAD_MAX_KEYS', S.number())
      .prop('UPLOAD_TOKEN_LIFETIME_MINS', S.number())
      .prop('VERIFY_RATE_LIMIT_SECS', S.number())
      .prop('CALLBACK_RATE_LIMIT_SECS', S.anyOf([S.number(), S.null()]))
      .prop(
        'CALLBACK_RATE_LIMIT_REQUEST_COUNT',
        S.anyOf([S.number(), S.null()])
      )
      .prop('DEVICE_CHECK_KEY_ID', S.string())
      .prop('DEVICE_CHECK_KEY', S.string())
      .prop('DEVICE_CHECK_TEAM_ID', S.string())
      .prop('DEVICE_CHECK_PACKAGE_NAME', S.string())
      .prop('DEVICE_CHECK_PACKAGE_DIGEST', S.string())
      .prop('DEVICE_CHECK_CERTIFICATE_DIGEST', S.string())
      .prop('DEVICE_CHECK_ROOT_CA', S.string())
      .prop('DEVICE_CHECK_TIME_DIFF_THRESHOLD_MINS', S.number())
      .prop('CALLBACK_QUEUE_URL', S.string())
      .prop('ASSETS_BUCKET', S.string())
      .prop('METRICS_CONFIG', S.string())
      .prop('ENABLE_CALLBACK', S.boolean())
      .prop('ENABLE_CHECK_IN', S.boolean())
      .prop('ENABLE_METRICS', S.boolean())
      .prop('DEFAULT_REGION', S.string())
  })

  const isProduction = /^\s*production\s*$/i.test(env.NODE_ENV)

  const config = {
    isProduction,
    fastify: {
      host: env.API_HOST,
      port: +env.API_PORT
    },
    fastifyInit: {
      trustProxy: 2,
      disableRequestLogging: true,
      requestIdHeader: 'x-amz-request-id',
      logger: {
        level: env.LOG_LEVEL,
        serializers: {
          req: request => ({
            method: request.raw.method,
            url: request.raw.url,
            hostname: request.hostname
          }),
          res: response => ({
            statusCode: response.statusCode
          })
        }
      }
    },
    cors: { origin: /true/i.test(env.CORS_ORIGIN) },
    pgPlugin: {
      read: env.DB_READ_HOST,
      write: env.DB_HOST,
      config: {
        port: +env.DB_PORT,
        ssl: env.DB_SSL,
        database: env.DB_DATABASE,
        user: env.DB_USER,
        password: env.DB_PASSWORD
      }
    },
    swagger: {
      routePrefix: '/docs',
      exposeRoute: true,
      swagger: {
        info: {
          title: 'Contact Tracing API Service',
          description: 'API service for contact tracing',
          version
        }
      }
    },
    security: {
      refreshTokenExpiry: env.REFRESH_TOKEN_EXPIRY,
      codeLifetime: env.CODE_LIFETIME_MINS,
      encryptKey: env.ENCRYPT_KEY,
      tokenLifetime: env.TOKEN_LIFETIME_MINS,
      jwtSecret: env.JWT_SECRET,
      metricsRateLimit: env.METRICS_RATE_LIMIT_SECS,
      verifyRateLimit: env.VERIFY_RATE_LIMIT_SECS,
      callbackRateLimitSeconds: env.CALLBACK_RATE_LIMIT_SECS,
      callbackRateLimitRequestCount: env.CALLBACK_RATE_LIMIT_REQUEST_COUNT
    },
    exposures: {
      defaultRegion: env.DEFAULT_REGION,
      maxKeys: env.UPLOAD_MAX_KEYS,
      tokenLifetime: env.UPLOAD_TOKEN_LIFETIME_MINS
    },
    deviceVerification: {
      keyId: env.DEVICE_CHECK_KEY_ID,
      key: env.DEVICE_CHECK_KEY,
      teamId: env.DEVICE_CHECK_TEAM_ID,
      apkPackageName: env.DEVICE_CHECK_PACKAGE_NAME,
      apkDigestSha256: env.DEVICE_CHECK_PACKAGE_DIGEST,
      apkCertificateDigestSha256: [env.DEVICE_CHECK_CERTIFICATE_DIGEST],
      safetyNetRootCa: env.DEVICE_CHECK_ROOT_CA,
      timeDifferenceThresholdMins: env.DEVICE_CHECK_TIME_DIFF_THRESHOLD_MINS
    },
    aws: {
      assetsBucket: env.ASSETS_BUCKET,
      callbackQueueUrl: env.CALLBACK_QUEUE_URL
    },
    metrics: env.METRICS_CONFIG ? JSON.parse(env.METRICS_CONFIG) : {},
    routes: {
      callback: env.ENABLE_CALLBACK,
      checkIn: env.ENABLE_CHECK_IN,
      metrics: env.ENABLE_METRICS
    }
  }

  if (isProduction) {
    const ssm = new AWS.SSM({ region: env.AWS_REGION })
    const secretsManager = new AWS.SecretsManager({ region: env.AWS_REGION })

    const getParameter = async id => {
      const response = await ssm
        .getParameter({ Name: `${env.CONFIG_VAR_PREFIX}${id}` })
        .promise()

      return response.Parameter.Value
    }

    const getOptionalParameter = async (id, defaultValue = undefined) => {
      const value = await ssm
        .getParameter({ Name: `${env.CONFIG_VAR_PREFIX}${id}` })
        .promise()
        .then(response => {
          return response.Parameter.Value
        })
        // eslint-disable-next-line handle-callback-err
        .catch(error => {
          return defaultValue
        })

      return value
    }

    const getSecret = async id => {
      const response = await secretsManager
        .getSecretValue({ SecretId: `${env.CONFIG_VAR_PREFIX}${id}` })
        .promise()

      return JSON.parse(response.SecretString)
    }

    const rdsSecret = await getSecret('rds-read-write-create')
    const encryptSecret = await getSecret('encrypt')
    const jwtSecret = await getSecret('jwt')
    const deviceCheckSecret = await getSecret('device-check')

    config.fastify.host = await getParameter('api_host')
    config.fastify.port = Number(await getParameter('api_port'))
    config.fastifyInit.logger.level = await getParameter('log_level')
    config.cors.origin = /true/i.test(await getParameter('cors_origin'))
    config.security.refreshTokenExpiry = await getParameter(
      'security_refresh_token_expiry'
    )
    config.security.codeLifetime = Number(
      await getParameter('security_code_lifetime_mins')
    )
    config.exposures.tokenLifetime = Number(
      await getParameter('upload_token_lifetime_mins')
    )
    config.security.tokenLifetime = Number(
      await getParameter('security_token_lifetime_mins')
    )
    config.security.verifyRateLimit = Number(
      await getParameter('security_verify_rate_limit_secs')
    )

    // Read the callback rate limit parameters. Due to backward compatibility
    // it is perfectly reasonable for the value of security_callback_rate_limit_secs
    // to be undefined/null and in that case we do not want to call Number(...)
    // on it. That's why we do this extra check
    const callbackRateLimitSecsParameter = await getOptionalParameter(
      'security_callback_rate_limit_secs',
      null
    )
    if (callbackRateLimitSecsParameter != null) {
      config.security.callbackRateLimitSeconds = Number(
        callbackRateLimitSecsParameter
      )
    }
    config.security.callbackRateLimitRequestCount = Number(
      await getOptionalParameter(
        'security_callback_rate_limit_request_count',
        1
      )
    )

    config.exposures.defaultRegion = await getParameter('default_region')
    config.exposures.maxKeys = await getParameter('upload_max_keys')
    config.aws.assetsBucket = await getParameter('s3_assets_bucket')
    config.aws.callbackQueueUrl = await getParameter('callback_url')
    config.metrics = JSON.parse(await getParameter('metrics_config'))

    config.pgPlugin.read = await getParameter('db_reader_host')
    config.pgPlugin.write = await getParameter('db_host')
    config.pgPlugin.config.port = Number(await getParameter('db_port'))
    config.pgPlugin.config.database = await getParameter('db_database')

    if (/true/i.test(await getParameter('db_ssl'))) {
      config.pgPlugin.config.ssl = {
        ca: [rdsSecret.ca],
        rejectUnauthorized: true
      }
    }

    config.routes.callback = /true/i.test(await getParameter('enable_callback'))
    config.routes.checkIn = /true/i.test(await getParameter('enable_check_in'))
    config.routes.metrics = /true/i.test(await getParameter('enable_metrics'))

    config.pgPlugin.config.user = rdsSecret.username
    config.pgPlugin.config.password = rdsSecret.password
    config.security.encryptKey = encryptSecret.key
    config.security.jwtSecret = jwtSecret.key
    config.deviceVerification = deviceCheckSecret
  }

  return config
}

module.exports = getConfig
