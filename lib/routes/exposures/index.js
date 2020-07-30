const fp = require('fastify-plugin')
const schema = require('./schema')
const { Forbidden, Gone, TooManyRequests } = require('http-errors')
const {
  differenceInMinutes,
  differenceInSeconds,
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
  server.route({
    method: 'POST',
    url: '/exposures/verify',
    schema: schema.verify,
    handler: async request => {
      const { id } = request.authenticate()
      const { hash } = request.body
      const control = hash.substr(0, 128)
      const code = hash.substr(128)

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

      const [{ createdAt, onsetDate }] = hashRows

      if (
        differenceInMinutes(new Date(), new Date(createdAt)) >
        options.security.codeLifetime
      ) {
        throw new Gone()
      }

      const { rows } = await server.pg.write.query(
        tokenInsert({ id, onsetDate })
      )
      const [{ id: token }] = rows

      return { token }
    }
  })

  server.route({
    method: 'POST',
    url: '/exposures',
    schema: schema.upload,
    handler: async (request, response) => {
      const { id } = request.authenticate()
      const { exposures, platform, regions, token } = request.body

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

      const filteredExposures = exposures.filter(
        ({ rollingStartNumber, rollingPeriod }) => {
          const startTime = rollingStartNumber * 1000 * 600
          const duration = rollingPeriod * 1000 * 600

          return (
            onsetDate === null ||
            isAfter(new Date(startTime + duration), new Date(onsetDate))
          )
        }
      )

      if (filteredExposures.length > 0) {
        await server.pg.write.query(
          exposureInsert({
            exposures: filteredExposures,
            regions: regions || [options.exposures.defaultRegion]
          })
        )
      }

      await server.pg.write.query(
        metricsInsert({
          event: 'UPLOAD',
          os: platform,
          version: ''
        })
      )

      response.status(204)
    }
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
