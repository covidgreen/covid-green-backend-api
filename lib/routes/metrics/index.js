const fp = require('fastify-plugin')
const schema = require('./schema')
const { differenceInSeconds } = require('date-fns')
const { metricsInsert, requestInsert } = require('./query')
const { TooManyRequests } = require('http-errors')

async function metrics(server, options, done) {
  if (options.routes.metrics) {
    server.route({
      method: 'POST',
      url: '/metrics',
      schema: schema.event(options),
      handler: async (request, response) => {
        const { id } = request.authenticate()
        const { event, os, version } = request.body

        const { rows } = await server.pg.write.query(
          requestInsert({
            event,
            id,
            limit: options.metrics[event]
          })
        )

        const [{ lastRequest }] = rows

        if (
          differenceInSeconds(new Date(), new Date(lastRequest)) <
          options.metrics[event]
        ) {
          throw new TooManyRequests()
        }

        await server.pg.write.query(metricsInsert({ event, os, version }))

        response.status(204)
      }
    })
  }

  done()
}

module.exports = fp(metrics)
