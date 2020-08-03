const fp = require('fastify-plugin')
const schema = require('./schema')
const { SQS } = require('aws-sdk')
const { TooManyRequests } = require('http-errors')
const { metricsInsert } = require('../metrics/query')
const { registerUpdate } = require('./query')

/**
 * Allows users to request a callback from a Contact Tracer. If accepted, the request is added to the
 * AWS callback queue with information about the user to call. The user's phone # is submitted as
 * part of this request, but the phone # IS NOT stored with the user's database record. It is included
 * in the body of the AWS callback queue message so that Contact Tracers know which number to call.
 *
 * Note that within the AWS callback queue the user's ID and phone # are stored together. This is a
 * potential PII issue as it provides an identifiable mapping between users and their phone numbers.
 *
 * See schema.js/callback for details on what data can be submitted with this request.
 *
 * Users are identified by the 'id' in the claims of the request Authorization JWT header. The id value
 * comes from the registration that occurred when the user installed the application.
 *
 * When the request comes in the user's registration record will be updated setting the last_callback
 * column to the current timestamp IFF the last_callback column is empty. This prevents the same user
 * from entering multiple callback requests.
 *
 * Users will be allowed to request additional callbacks IFF some other process clears the last_callback
 * cell in the user's record. It will be up to each region to decide if they want to allow subsequent
 * callback requests. If they choose to support that then clearing the last_callback cell will allow
 * a subsequent callback request from the user.
 *
 * From what I can tell in the app, callbacks can be requested if the app determines the user was in
 * close contact with some exposure key (ie, a person with a positive diagnosis). Until the user gets
 * an actual callback the last_callback cell will have a value so the user will not be able to request
 * another callback. But, if the user has gotten a callback and the cell is set to NULL then the user
 * will be able to request another callback.
 *
 * All requests go through authentication which means both the user and device will be verified. This
 * process will prevent random people from submitting callback requests. Theoretically, only the app
 * can make this call.
 *
 * Responses:
 *  204: The callback request was successfully accepted and written to the database
 *  429: User has already requested a callback, and depending on the region rules, there is an existing
 *    unfulfilled callback already exists for the user
 */
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
