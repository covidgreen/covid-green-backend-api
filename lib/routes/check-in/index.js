const fp = require('fastify-plugin')
const schema = require('./schema')
const { TooManyRequests } = require('http-errors')
const { checkInInsert } = require('./query')

/**
 * Allows users to submit a daily health checkin. All application users can perform a daily checkin
 * allowing them to submit basic health information including whether they have a fever. See schema.js/checkIn
 * for details on what data can be submitted.
 *
 * Users are identified by the 'id' in the claims of the request Authorization JWT header. The id value comes from
 * the registration that occurred when the user installed the application.
 *
 * Responses:
 *  204: This is the first checkIn the user has submitted on a given day, and was successfully saved
 *  429: This is a subsequent checkIn the user has submitted on a given day, the checkIn data was not saved
 */
async function checkIn(server, options, done) {
  if (options.routes.checkIn) {
    server.route({
      method: 'POST',
      url: '/check-in',
      schema: schema.checkIn,
      handler: async (request, response) => {
        const { id } = request.authenticate()

        const { rowCount } = await server.pg.write.query(
          checkInInsert({
            ...request.body,
            id
          })
        )

        if (rowCount === 0) {
          throw new TooManyRequests()
        }

        response.status(204)
      }
    })
  }

  done()
}

module.exports = fp(checkIn)
