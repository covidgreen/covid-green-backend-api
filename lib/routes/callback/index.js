const fp = require('fastify-plugin')
const schema = require('./schema')
const { SQS } = require('aws-sdk')
const { TooManyRequests } = require('http-errors')
const { metricsInsert } = require('../metrics/query')
const { registerUpdate } = require('./query')

async function callback(server, options, done) {
  if (options.routes.callback) {
    const sqs = new SQS({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    })

    server.route({
      method: 'POST',
      url: '/callback',
      schema: schema.callback,
      handler: async (request, response) => {
        const { id } = request.authenticate()
        const { closeContactDate, mobile, payload } = request.body
        const { rowCount } = await server.pg.write.query(registerUpdate({ id }))

        if (rowCount === 0) {
          throw new TooManyRequests()
        }

        const body = {
          closeContactDate,
          failedAttempts: 0,
          id,
          mobile,
          payload
        }

        const message = {
          QueueUrl: options.aws.callbackQueueUrl,
          MessageBody: JSON.stringify(body)
        }

        await sqs.sendMessage(message).promise()

        await server.pg.write.query(
          metricsInsert({
            event: 'CALLBACK_REQUEST',
            os: '',
            version: ''
          })
        )

        response.status(204)
      }
    })
  }

  done()
}

module.exports = fp(callback)
