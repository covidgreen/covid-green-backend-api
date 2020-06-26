const fp = require('fastify-plugin')
const schema = require('./schema')
const { TooManyRequests } = require('http-errors')
const { checkInInsert } = require('./query')

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
