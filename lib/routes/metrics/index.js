const fp = require('fastify-plugin')
const schema = require('./schema')
const { differenceInSeconds } = require('date-fns')
const { metricsInsert, payloadInsert, requestInsert } = require('./query')
const { TooManyRequests } = require('http-errors')

/**
 * Allows users to submit periodic metric values from the App. The actual metric value is not stored with
 * user identifying information, but we do keep track of when individual user's have submitted a particular
 * metric event. The request contains the metric event name, device OS, and App version. See schema.js/event
 * for details on what data can be submitted.
 *
 * Users are identified by the 'id' in the claims of the request Authorization JWT header. The id value comes from
 * the registration that occurred when the user installed the application.
 *
 * Known supported events can be found in the .env file under METRICS_CONFIG and as of this writing are defined as
 *
 * METRICS_CONFIG= {
 *   "CONTACT_UPLOAD": 60,
 *   "CHECK_IN": 60,
 *   "FORGET": 60,
 *   "TOKEN_RENEWAL": 60,
 *   "CALLBACK_OPTIN": 60,
 *   "CALLBACK_REQUEST": 60,
 *   "DAILY_ACTIVE_TRACE": 60,
 *   "CONTACT_NOTIFICATION": 60
 * }
 *
 * The numeric value is the minimum number of minutes that must pass before the same user can submit a value
 * for a metric. Ie, users can only submit a CHECK_IN metric every 60 minutes. This does not restrict their
 * ability to submit actual checkins, just their ability to save a metric saying they did submit a checkin.
 *
 * When a request comes in we check to see the last time this user submitted an event metric and if enough
 * time has passed since the previous submission we then save the metric record. Note that actual metric
 * values are not saved with any user-identifying information. The metric values themselves are saved without
 * the user ID so it will not be possible to map from a user to the actual submitted metric values.
 *
 * Responses:
 *  204: If metric accepted and saved
 *  429: Not enough time has passed since the most recent submission of this metric event
 */
async function metrics(server, options, done) {
  if (options.routes.metrics) {
    server.route({
      method: 'POST',
      url: '/metrics',
      schema: schema.event(options),
      handler: async (request, response) => {
        const { id } = request.authenticate()
        const { event, os, payload, version } = request.body

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

        if (payload && Object.keys(payload).length > 0) {
          await server.pg.write.query(payloadInsert({ event, payload }))
        }

        response.status(204)
      }
    })
  }

  done()
}

module.exports = fp(metrics)
