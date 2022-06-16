const envSchema = require('env-schema')
const fetch = require('node-fetch')
const S = require('fluent-schema')
const AWS = require('aws-sdk')
const { version } = require('../../package.json')

function parseCorsParameter(param) {
  if (param === 'true') return true
  if (param === 'false') return false
  return param
}

async function getConfig() {
  const env = envSchema({
    dotenv: true,
    schema: S.object()
      .prop('CONFIG_VAR_PREFIX', S.string())
      .prop('NODE_ENV', S.string())
      .prop('TIME_ZONE', S.string())
      .prop('API_HOST', S.string())
      .prop('API_PORT', S.string())
      .prop('CORS_ORIGIN', S.string())
      .prop('CORS_CREDENTIALS', S.string())
      .prop('DB_HOST', S.string())
      .prop('DB_READ_HOST', S.string())
      .prop('DB_PORT', S.string())
      .prop('DB_USER', S.string())
      .prop('DB_PASSWORD', S.string())
      .prop('DB_DATABASE', S.string())
      .prop('DB_SSL', S.boolean())
      .prop('DB_POOL_SIZE', S.string())
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
      .prop('JWT_ISSUER', S.string())
      .prop('JWT_SECRET', S.string())
      .prop('QR_CODE_APP_NAME', S.string())
      .prop('QR_CODE_VERSION', S.string())
      .prop('QR_CODE_JWT_SECRET', S.string())
      .prop('REFRESH_TOKEN_EXPIRY', S.string())
      .prop('TOKEN_LIFETIME_MINS', S.number())
      .prop('CODE_LIFETIME_MINS', S.number())
      .prop('DEEP_LINKS_ALLOWED', S.boolean())
      .prop('UPLOAD_MAX_KEYS', S.number())
      .prop('UPLOAD_TOKEN_LIFETIME_MINS', S.number())
      .prop('VERIFY_RATE_LIMIT_SECS', S.number())
      .prop('CALLBACK_RATE_LIMIT_SECS', S.anyOf([S.number(), S.null()]))
      .prop(
        'CALLBACK_RATE_LIMIT_REQUEST_COUNT',
        S.anyOf([S.number(), S.null()])
      )
      .prop('NOTICES_RATE_LIMIT_SECS', S.anyOf([S.number(), S.null()]))
      .prop('DEVICE_CHECK_KEY_ID', S.string())
      .prop('DEVICE_CHECK_KEY', S.string())
      .prop('DEVICE_CHECK_TEAM_ID', S.string())
      .prop('DEVICE_CHECK_PACKAGE_NAME', S.string())
      .prop('DEVICE_CHECK_PACKAGE_DIGEST', S.string())
      .prop('DEVICE_CHECK_CERTIFICATE_DIGEST', S.string())
      .prop('DEVICE_CHECK_ROOT_CA', S.string())
      .prop('DEVICE_CHECK_TIME_DIFF_THRESHOLD_MINS', S.number())
      .prop('DEVICE_CHECK_RECAPTCHA_SECRET', S.string())
      .prop('DEVICE_CHECK_DISABLED', S.boolean())
      .prop(`DEVICE_CHECK_VALIDATE_CERT_CHAIN`, S.boolean())
      .prop('CALLBACK_QUEUE_URL', S.string())
      .prop('NOTICES_QUEUE_URL', S.string())
      .prop('ASSETS_BUCKET', S.string())
      .prop('METRICS_CONFIG', S.string())
      .prop('ENABLE_CALLBACK', S.boolean())
      .prop('ENABLE_CHECK_IN', S.boolean())
      .prop('ENABLE_METRICS', S.boolean())
      .prop('ENABLE_NOTICES', S.boolean())
      .prop('ENABLE_QR_VENUES', S.boolean())
      .prop('DEFAULT_REGION', S.string())
      .prop('CERTIFICATE_AUDIENCE', S.string())
      .prop('VERIFY_KEY_ID', S.string())
      .prop('VERIFY_PRIVATE_KEY', S.string())
      .prop('VERIFY_PUBLIC_KEY', S.string())
      .prop('VERIFY_PROXY_URL', S.string())
      .prop('VERIFY_PROXY_API_KEY', S.string())
      .prop('HSTS_MAX_AGE', S.number())
      .prop('QR_ALERT_QUEUE_URL', S.string())
      .prop('QR_EMAIL_ADDRESS_VERIFY_LIFETIME', S.number())
      .prop('QR_QUEUE_URL', S.string())
      .prop('QR_SECRET', S.string())
      .prop('ALLOW_NO_TOKEN', S.boolean())
      .prop('TOKEN_LIFETIME_NO_REFRESH', S.string())
      .prop('DEEPLINK_DEFAULT_WEBPAGE', S.string())
      .prop('DEEPLINK_PACKAGE_NAME', S.string())
      .prop('DEEPLINK_APPSTORE_LINK', S.string())
      .prop('LOG_CALLBACK_REQUEST', S.boolean())
      .prop('CODE_LIFETIME_DEEPLINK_MINS', S.number())
      .prop('ENABLE_REQUEST_LOGGING', S.boolean().default(false))
      .prop('DISABLE_EXPOSURE_DATA', S.boolean().default(false))
      .prop('DISABLE_REGISTER', S.boolean().default(false))
      .prop('DISABLE_EXPOSURE', S.boolean().default(false))
  })

  const isProduction = /^\s*production\s*$/i.test(env.NODE_ENV)

  const config = {
    isProduction,
    timeZone: env.TIME_ZONE,
    fastify: {
      host: env.API_HOST,
      port: +env.API_PORT
    },
    fastifyInit: {
      enableRequestLogging: env.ENABLE_REQUEST_LOGGING,
      trustProxy: 2,
      disableRequestLogging: true,
      requestIdHeader: 'x-amz-request-id',
      logger: {
        level: env.LOG_LEVEL,
        serializers: {
          req: (request) => ({
            method: request.raw.method,
            url: request.raw.url,
            hostname: request.hostname
          }),
          res: (response) => ({
            statusCode: response.statusCode
          })
        }
      }
    },
    cors: {
      origin: parseCorsParameter(env.CORS_ORIGIN),
      credentials: /true/i.test(env.CORS_CREDENTIALS)
    },
    pgPlugin: {
      read: env.DB_READ_HOST,
      write: env.DB_HOST,
      config: {
        port: +env.DB_PORT,
        database: env.DB_DATABASE,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
        max: +env.DB_POOL_SIZE
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
      codeLifetimeDeeplink: env.CODE_LIFETIME_DEEPLINK_MINS,
      allowDeeplinks: env.DEEP_LINKS_ALLOWED,
      encryptKey: env.ENCRYPT_KEY,
      tokenLifetime: env.TOKEN_LIFETIME_MINS,
      jwtIssuer: env.JWT_ISSUER,
      jwtSecret: env.JWT_SECRET,
      metricsRateLimit: env.METRICS_RATE_LIMIT_SECS,
      verifyRateLimit: env.VERIFY_RATE_LIMIT_SECS,
      callbackRateLimitSeconds: env.CALLBACK_RATE_LIMIT_SECS,
      callbackRateLimitRequestCount: env.CALLBACK_RATE_LIMIT_REQUEST_COUNT,
      noticesRateLimitSeconds: env.NOTICES_RATE_LIMIT_SECS,
      hstsMaxAge: env.HSTS_MAX_AGE,
      allowNoToken: env.ALLOW_NO_TOKEN,
      tokenLifetimeNoRefresh: env.TOKEN_LIFETIME_NO_REFRESH,
      logCallbackRequest: env.LOG_CALLBACK_REQUEST,
      allowedLogErrorPayload: env.ALLOWED_LOG_ERROR_PAYLOAD
    },
    exposures: {
      certificateAudience: env.CERTIFICATE_AUDIENCE,
      defaultRegion: env.DEFAULT_REGION,
      maxKeys: env.UPLOAD_MAX_KEYS,
      tokenLifetime: env.UPLOAD_TOKEN_LIFETIME_MINS,
      disableExposureData: env.DISABLE_EXPOSURE_DATA
    },
    deviceVerification: {
      keyId: env.DEVICE_CHECK_KEY_ID,
      key: env.DEVICE_CHECK_KEY,
      teamId: env.DEVICE_CHECK_TEAM_ID,
      apkPackageName: env.DEVICE_CHECK_PACKAGE_NAME,
      apkDigestSha256: env.DEVICE_CHECK_PACKAGE_DIGEST,
      apkCertificateDigestSha256: [env.DEVICE_CHECK_CERTIFICATE_DIGEST],
      safetyNetRootCa: env.DEVICE_CHECK_ROOT_CA,
      timeDifferenceThresholdMins: env.DEVICE_CHECK_TIME_DIFF_THRESHOLD_MINS,
      recaptchaSecret: env.DEVICE_CHECK_RECAPTCHA_SECRET,
      deviceCheckDisabled: env.DEVICE_CHECK_DISABLED,
      validateCertChain: env.DEVICE_CHECK_VALIDATE_CERT_CHAIN
    },
    aws: {
      assetsBucket: env.ASSETS_BUCKET,
      callbackQueueUrl: env.CALLBACK_QUEUE_URL,
      noticesQueueUrl: env.NOTICES_QUEUE_URL
    },
    metrics: env.METRICS_CONFIG ? JSON.parse(env.METRICS_CONFIG) : {},
    routes: {
      callback: env.ENABLE_CALLBACK,
      checkIn: env.ENABLE_CHECK_IN,
      metrics: env.ENABLE_METRICS,
      notices: env.ENABLE_NOTICES,
      qr: env.ENABLE_QR_VENUES,
      disableRegister: env.DISABLE_REGISTER,
      disableExposure: env.DISABLE_EXPOSURE
    },
    verify: {
      keyId: env.VERIFY_KEY_ID,
      privateKey: env.VERIFY_PRIVATE_KEY,
      publicKey: env.VERIFY_PUBLIC_KEY
    },
    qr: {
      alertQueueUrl: env.QR_ALERT_QUEUE_URL,
      emailAddressVerifyLifetime: env.QR_EMAIL_ADDRESS_VERIFY_LIFETIME,
      generateQueueUrl: env.QR_QUEUE_URL,
      secret: env.QR_SECRET
    },
    verifyProxy: {
      url: env.VERIFY_PROXY_URL,
      apiKey: env.VERIFY_PROXY_API_KEY
    },
    deeplinks: {
      packageName: env.DEEPLINK_PACKAGE_NAME,
      appstoreLink: env.DEEPLINK_APPSTORE_LINK,
      defaultWebPage: env.DEEPLINK_DEFAULT_WEBPAGE
    }
  }

  if (isProduction) {
    const ssm = new AWS.SSM({ region: env.AWS_REGION })
    const secretsManager = new AWS.SecretsManager({ region: env.AWS_REGION })

    const getParameter = async (id) => {
      const response = await ssm
        .getParameter({ Name: `${env.CONFIG_VAR_PREFIX}${id}` })
        .promise()

      return response.Parameter.Value
    }

    const getOptionalParameter = async (id, defaultValue = undefined) => {
      const value = await ssm
        .getParameter({ Name: `${env.CONFIG_VAR_PREFIX}${id}` })
        .promise()
        .then((response) => {
          return response.Parameter.Value
        })
        // eslint-disable-next-line handle-callback-err
        .catch(() => {
          console.log(
            `Parameter ${id} not found, using default value "${defaultValue}"`
          )
          return defaultValue
        })

      return value
    }

    const getSecret = async (id) => {
      const response = await secretsManager
        .getSecretValue({ SecretId: `${env.CONFIG_VAR_PREFIX}${id}` })
        .promise()

      return JSON.parse(response.SecretString)
    }

    const rdsSecret = await getSecret('rds-read-write-create')
    const encryptSecret = await getSecret('encrypt')
    const jwtSecret = await getSecret('jwt')
    const deviceCheckSecret = await getSecret('device-check')
    const verifySecret = await getSecret('verify')

    config.timeZone = await getParameter('time_zone')
    config.fastify.host = await getParameter('api_host')
    config.fastify.port = Number(await getParameter('api_port'))
    config.fastifyInit.logger.level = await getParameter('log_level')
    config.fastifyInit.enableRequestLogging = /true/i.test(
      await getOptionalParameter('enable_request_logging', false)
    )
    config.cors.origin = parseCorsParameter(await getParameter('cors_origin'))
    config.cors.credentials = /true/i.test(
      await getOptionalParameter('cors_credentials', false)
    )
    config.security.jwtIssuer = await getParameter('jwt_issuer')
    config.security.refreshTokenExpiry = await getParameter(
      'security_refresh_token_expiry'
    )
    config.security.allowNoToken = /true/i.test(
      await getOptionalParameter('security_allow_no_token', false)
    )
    config.security.tokenLifetimeNoRefresh = await getOptionalParameter(
      'security_token_life_time_no_refresh',
      '1y'
    )

    config.security.codeLifetime = Number(
      await getParameter('security_code_lifetime_mins')
    )
    config.security.codeLifetimeDeeplink = Number(
      await getOptionalParameter('security_code_lifetime_deeplink_mins', 1440)
    )
    config.security.allowDeeplinks = /true/i.test(
      await getOptionalParameter('security_code_deeplinks_allowed', false)
    )
    config.exposures.tokenLifetime = Number(
      await getParameter('upload_token_lifetime_mins')
    )
    config.exposures.disableExposureData = /true/i.test(
      await getOptionalParameter('disable_exposure_data', false)
    )
    config.security.tokenLifetime = Number(
      await getParameter('security_token_lifetime_mins')
    )
    config.security.verifyRateLimit = Number(
      await getParameter('security_verify_rate_limit_secs')
    )
    config.security.hstsMaxAge = Number(await getParameter('hsts_max_age'))

    config.security.logCallbackRequest = /true/i.test(
      await getOptionalParameter('log_callback_request', false)
    )
    config.security.allowedLogErrorPayload = /true/i.test(
      await getOptionalParameter('log_error_payload', false)
    )

    config.exposures.certificateAudience = await getParameter(
      'certificate_audience'
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

    // Read the notices rate limit parameters. Due to backward compatibility
    // it is perfectly reasonable for the value of security_notices_rate_limit_secs
    // to be undefined/null and in that case we do not want to call Number(...)
    // on it. That's why we do this extra check
    const noticesRateLimitSecsParameter = await getOptionalParameter(
      'security_self_isolation_notices_rate_limit_secs',
      null
    )
    if (noticesRateLimitSecsParameter != null) {
      config.security.noticesRateLimitSeconds = Number(
        noticesRateLimitSecsParameter
      )
    }
    config.exposures.defaultRegion = await getParameter('default_region')
    config.exposures.maxKeys = await getParameter('upload_max_keys')
    config.aws.assetsBucket = await getParameter('s3_assets_bucket')
    config.aws.callbackQueueUrl = await getParameter('callback_url')
    config.aws.noticesQueueUrl = await getOptionalParameter(
      'self_isolation_notices_url',
      'NA'
    )
    config.metrics = JSON.parse(await getParameter('metrics_config'))
    config.pgPlugin.read = await getParameter('db_reader_host')
    config.pgPlugin.write = await getParameter('db_host')
    config.pgPlugin.config.port = Number(await getParameter('db_port'))
    config.pgPlugin.config.database = await getParameter('db_database')
    config.pgPlugin.config.max = Number(await getParameter('db_pool_size'))

    if (/true/i.test(await getParameter('db_ssl'))) {
      const certResponse = await fetch(
        'https://s3.amazonaws.com/rds-downloads/rds-combined-ca-bundle.pem'
      )
      const certBody = await certResponse.text()

      config.pgPlugin.config.ssl = {
        ca: [certBody],
        rejectUnauthorized: true
      }
    }

    config.routes.callback = /true/i.test(await getParameter('enable_callback'))
    config.routes.checkIn = /true/i.test(await getParameter('enable_check_in'))
    config.routes.metrics = /true/i.test(await getParameter('enable_metrics'))

    config.routes.notices = /true/i.test(
      await getOptionalParameter('enable_self_isolation_notices', 'false')
    )
    config.routes.qr = /true/i.test(
      await getOptionalParameter('enable_qr_venues', 'false')
    )
    config.routes.disableRegister = /true/i.test(
      await getOptionalParameter('disable_register', 'false')
    )
    config.routes.disableExposure = /true/i.test(
      await getOptionalParameter('disable_exposure', 'false')
    )
    if (config.routes.qr) {
      const qrSecret = await getSecret('qr')

      config.qr.emailAddressVerifyLifetime = Number(
        await getParameter('email_address_verify_lifetime')
      )
      config.qr.alertQueueUrl = await getParameter('qr_alert_queue_url')
      config.qr.generateQueueUrl = await getParameter('qr_generate_queue_url')
      config.qr.secret = qrSecret.privateKey
    }

    config.verifyProxy.url = await getOptionalParameter('verify_proxy_url', '')

    if (config.verifyProxy.url !== '') {
      const proxySecret = await getSecret('verify-proxy')

      config.verifyProxy.apiKey = proxySecret.verifyApiKey
    }

    config.pgPlugin.config.user = rdsSecret.username
    config.pgPlugin.config.password = rdsSecret.password
    config.security.encryptKey = encryptSecret.key
    config.security.jwtSecret = jwtSecret.key
    config.deviceVerification = deviceCheckSecret
    config.verify = verifySecret

    config.deeplinks.packageName = await getOptionalParameter(
      'deeplink_android_package_name',
      ''
    )
    config.deeplinks.appstoreLink = await getOptionalParameter(
      'deeplink_appstore_link',
      ''
    )
    config.deeplinks.defaultWebPage = await getOptionalParameter(
      'deeplink_default_webpage',
      ''
    )
  }

  return config
}

module.exports = getConfig
