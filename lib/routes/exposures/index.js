const crypto = require('crypto')
const fp = require('fastify-plugin')
const schema = require('./schema')
const { BadRequest, Forbidden, Gone, TooManyRequests } = require('http-errors')
const {
  differenceInMinutes,
  differenceInSeconds,
  format,
  isAfter
} = require('date-fns')
const { metricsInsert } = require('../metrics/query')
const {
  exposureInsert,
  exposureSelect,
  registerUpdate,
  tokenDelete,
  tokenInsert,
  verificationDelete,
  verificationUpdate
} = require('./query')

async function exposures(server, options, done) {
  const hash = value => {
    const sha512 = crypto.createHash('sha512')
    const data = sha512.update(value, 'utf8')

    return data.digest('hex')
  }

  const exchangeCodeForToken = async (id, control, code) => {
    const { rowCount: registerRateLimit } = await server.pg.write.query(
      registerUpdate({
        rateLimit: options.security.verifyRateLimit,
        id
      })
    )

    if (registerRateLimit === 0) {
      throw new TooManyRequests()
    }

    const { rows: controlRows } = await server.pg.write.query(
      verificationUpdate({
        rateLimit: options.security.verifyRateLimit,
        control
      })
    )

    if (controlRows.length === 0) {
      throw new Forbidden()
    }

    const [{ lastAttempt }] = controlRows

    if (
      differenceInSeconds(new Date(), new Date(lastAttempt)) <
      options.security.verifyRateLimit
    ) {
      throw new TooManyRequests()
    }

    const { rows: hashRows } = await server.pg.write.query(
      verificationDelete({
        control,
        code
      })
    )

    if (hashRows.length === 0) {
      throw new Forbidden()
    }

    const [{ createdAt, onsetDate, testType }] = hashRows

    if (
      differenceInMinutes(new Date(), new Date(createdAt)) >
      options.security.codeLifetime
    ) {
      throw new Gone()
    }

    const { rows } = await server.pg.write.query(
      tokenInsert({ id, onsetDate, testType })
    )

    const [{ id: token }] = rows

    return { onsetDate, testType, token }
  }

  server.route({
    method: 'POST',
    url: '/exposures/verify',
    schema: schema.verify,
    handler: async request => {
      const { id } = request.authenticate()
      const { hash } = request.body

      const controlHash = hash.substr(0, 128)
      const codeHash = hash.substr(128)

      const { token } = await exchangeCodeForToken(id, controlHash, codeHash)

      return { token }
    }
  })

  server.route({
    method: 'POST',
    url: '/verify',
    schema: schema.exchange,
    handler: async request => {
      const { id } = request.authenticate()
      const { code } = request.body

      const controlHash = hash(code.substr(0, Math.floor(code.length / 2)))
      const codeHash = hash(code)

      const { onsetDate, testType, token } = await exchangeCodeForToken(
        id,
        controlHash,
        codeHash
      )

      if (!onsetDate) {
        throw new Forbidden()
      }

      const symptomDate = format(onsetDate, 'yyyy-MM-dd')

      return {
        error: '',
        symptomDate,
        testtype: testType,
        token: server.jwt.sign(
          {},
          {
            audience: options.security.jwtIssuer,
            expiresIn: options.security.refreshTokenExpiry,
            issuer: options.security.jwtIssuer,
            jwtid: token,
            subject: `${testType}.${symptomDate}`
          }
        )
      }
    }
  })

  server.route({
    method: 'POST',
    url: '/certificate',
    schema: schema.certificate,
    handler: async request => {
      const { id } = request.authenticate()
      const { ekeyhmac, token } = request.body

      const { jti } = server.jwt.verify(token, {
        audience: options.security.jwtIssuer
      })

      const { rowCount, rows } = await server.pg.write.query(
        tokenDelete({ id, token: jti })
      )

      if (rowCount === 0) {
        throw new Forbidden()
      }

      const [{ onsetDate, testType }] = rows

      if (!onsetDate) {
        throw new Forbidden()
      }

      return {
        certificate: server.jwt.sign(
          {
            reportType: testType,
            symptomOnsetInterval: Math.floor(onsetDate.getTime() / 1000 / 600),
            trisk: [],
            tekmac: ekeyhmac
          },
          {
            audience: options.exposures.certificateAudience,
            expiresIn: '15m',
            issuer: options.security.jwtIssuer
          }
        ),
        error: ''
      }
    }
  })

  const uploadHandler = async (request, response) => {
    const { id } = request.authenticate()
    const {
      exposures,
      platform,
      regions,
      temporaryExposureKeys,
      token
    } = request.body
    const { deviceVerification } = options

    const resolvedExposures = exposures || temporaryExposureKeys
    const resolvedPlatform = platform || ''
    const resolvedRegions = regions || [options.exposures.defaultRegion]

    let resolvedOnsetDate = null
    let resolvedTestType = 'confirmed'

    if (token) {
      await request.verify(token.replace(/-/g, ''))

      const { rows } = await server.pg.write.query(tokenDelete({ id, token }))

      if (rows.length === 0) {
        throw new Forbidden()
      }

      const [{ createdAt, onsetDate }] = rows

      if (
        differenceInMinutes(new Date(), new Date(createdAt)) >
        options.exposures.tokenLifetime
      ) {
        throw new Gone()
      }

      resolvedOnsetDate = onsetDate
    } else {
      const { appPackageName, hmackey, verificationPayload } = request.body

      const { reportType, symptomOnsetInterval, tekmac } = server.jwt.verify(
        verificationPayload,
        {
          audience: options.exposures.certificateAudience,
          issuer: options.security.jwtIssuer
        }
      )

      // TODO: apply necessary transformations and remove this log
      request.log.info({ tekmac }, 'expected nonce')
      await request.verify(tekmac)

      const exposuresString = resolvedExposures
        .sort((a, b) => a.keyData.localeCompare(b.keyData))
        .map(
          ({
            keyData,
            rollingStartNumber,
            rollingPeriod,
            transmissionRiskLevel
          }) =>
            `${keyData}.${rollingStartNumber}.${rollingPeriod}.${transmissionRiskLevel}`
        )
        .join(',')

      const secret = Buffer.from(hmackey, 'base64')
      const hash = crypto
        .createHmac('sha256', secret)
        .update(exposuresString)
        .digest('base64')

      if (
        deviceVerification.apkPackageName &&
        appPackageName !== deviceVerification.apkPackageName
      ) {
        throw new Forbidden('Invalid package name')
      }

      if (hash !== tekmac) {
        throw new Forbidden('Keys do not match HMAC')
      }

      resolvedOnsetDate = new Date(symptomOnsetInterval * 100 * 600)
      resolvedTestType = reportType
    }

    const filteredExposures = resolvedExposures.filter(
      ({ keyData, rollingStartNumber, rollingPeriod }) => {
        const startTime = rollingStartNumber * 1000 * 600
        const duration = rollingPeriod * 1000 * 600
        const decodedKeyData = Buffer.from(keyData, 'base64')

        if (decodedKeyData.length !== 16) {
          throw new BadRequest('Invalid key length')
        }

        return (
          resolvedOnsetDate === null ||
          isAfter(new Date(startTime + duration), new Date(resolvedOnsetDate))
        )
      }
    )

    if (filteredExposures.length > 0) {
      await server.pg.write.query(
        exposureInsert({
          exposures: filteredExposures,
          regions: resolvedRegions,
          testType: resolvedTestType
        })
      )
    }

    await server.pg.write.query(
      metricsInsert({
        event: 'UPLOAD',
        os: resolvedPlatform,
        version: ''
      })
    )

    return {
      insertedExposures: filteredExposures.length,
      error: '',
      padding: crypto
        .randomBytes(Math.floor(Math.random() * 1024 + 1024))
        .toString('base64')
    }
  }

  server.route({
    method: 'POST',
    url: '/exposures',
    schema: schema.upload,
    handler: uploadHandler
  })

  server.route({
    method: 'POST',
    url: '/publish',
    schema: schema.upload,
    handler: uploadHandler
  })

  server.route({
    method: 'GET',
    url: '/exposures',
    schema: schema.list,
    handler: async request => {
      request.authenticate()

      const { since, region } = request.query

      const { rows } = await server.pg.read.query(
        exposureSelect({
          region: region || options.exposures.defaultRegion,
          since
        })
      )

      return rows
    }
  })

  done()
}

module.exports = fp(exposures)
