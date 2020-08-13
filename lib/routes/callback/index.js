const fp = require('fastify-plugin')
const schema = require('./schema')
const { SQS } = require('aws-sdk')
const { BadRequest, TooManyRequests } = require('http-errors')
const { metricsInsert } = require('../metrics/query')
const {
  registerOnetimeCallback,
  registerRateLimitedCallback
} = require('./query')

/**
 * Allows users to request a callback from a Contact Tracer. If accepted, the request is added to the
 * AWS callback queue with information about the user to call. The user's phone # is submitted as
 * part of this request, but the phone # IS NOT stored with the user's database record. It is included
 * in the body of the AWS callback queue message so that Contact Tracers know which number to call.
 *
 * NOTE: Within the AWS callback queue the user's ID and phone # are stored together. This is a
 * potential PII issue as it provides an identifiable mapping between users and their phone numbers.
 * While the expected implementation of the code reading off that AWS callback queue would not store
 * the user's ID and phone # in any additional system, that the items are put into the queue
 * together leaves open the possibility for PII/GDPR issues.
 *
 * See schema.js/callback for details on what data can be submitted with this request.
 *
 * Users are identified by the 'id' in the claims of the request Authorization JWT header. The id value
 * comes from the registration that occurred when the user installed the application.
 *
 * There are three rate limit modes, depending on configured settings:
 *  CALLBACK_RATE_LIMIT_SECS is not set: a user is allowed to request a single callback, ever
 *  CALLBACK_RATE_LIMIT_SECS == 0: a user is allowed to request N callback requests with no rate limiting
 *  CALLBACK_RATE_LIMIT_SECS > 0: a user can request subsequent callbacks after # of seconds between each
 *
 * All requests go through authentication which means both the user and device will be verified. This
 * process will prevent random people from submitting callback requests. Theoretically, only the app
 * can make this call.
 *
 * Responses:
 *  204: The callback request was successfully accepted and written to the database
 *  429: User has already requested a callback, and depending on the region rules, there is an existing
 *    unfulfilled callback for the user
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
        let { closeContactDate, mobile, payload } = request.body
        const phoneRegex = new RegExp('(^|[\\s])(\\+?\\d{1,3}[\\s-\\.]?)?' +
            '\\(?\\d{3}\\)?[\\s.-]*\\d{3}\\s*[\\s.-]*\\s*\\d{4}' + 
            '(\\s*x\\s*\\d+)?(\\s|$)', 'g');
        if (!mobile.match(phoneRegex)) {
            throw new BadRequest('Supplied an incorrectly formatted phone number.');
        }
        mobile = mobile.replace(/[^0-9\+]/g, '')
        const { callbackRateLimitSeconds: rateLimitSeconds } = options.security
        const query =
          rateLimitSeconds == null || rateLimitSeconds < 0
            ? registerOnetimeCallback({ registrationId: id })
            : registerRateLimitedCallback({
                registrationId: id,
                rateLimitSeconds
              })

        const { rowCount } = await server.pg.write.query(query)

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
