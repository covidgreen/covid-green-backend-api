const fp = require('fastify-plugin')
const { SQS } = require('aws-sdk')
const { NotFound, BadRequest, TooManyRequests } = require('http-errors')
const { randomBytes } = require('crypto')

const schema = require('./schema')
const {
  registerRateLimitedNotice,
  insert,
  selectByNonce,
  makeAvailable,
  reserve,
  consume,
  free,
  isAvailable
} = require('./query')
const { metricsInsert } = require('../metrics/query')

const DEFAULT_RATE_LIMIT = 86400

async function notices(server, options) {
  if (!options.routes.notices) {
    server.log.info('Notices Endpoint: Off')
    return
  }

  const rateLimitSeconds =
    options.security.noticesRateLimitSeconds || DEFAULT_RATE_LIMIT

  server.log.info(
    `Notices Endpoint: On, rate limit: 1 every ${rateLimitSeconds} seconds`
  )

  async function checkRateLimit(registrationId) {
    const query = registerRateLimitedNotice({
      registrationId,
      rateLimitSeconds
    })

    const { rowCount } = await server.pg.write.query(query)

    if (rowCount === 0) {
      throw new TooManyRequests()
    }
  }

  const sqs = new SQS({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  })

  async function createNewNotice() {
    const nonce = (await randomBytes(32)).toString('hex')
    await server.pg.write.query(insert(nonce))
    return nonce
  }

  async function getKeyFromNonce(nonce) {
    const { rowCount, rows } = await server.pg.read.query(selectByNonce(nonce))

    if (rowCount === 0) {
      throw new NotFound('Invalid or expired nonce')
    }

    return rows[0]
  }

  async function makeKeyAvailable(key, endDate) {
    await server.pg.write.query(makeAvailable(key, endDate))
  }

  async function reserveKeyIfAvailable(log, key) {
    const { rowCount, rows } = await server.pg.write.query(reserve(key))
    if (rowCount === 0) {
      log.info(
        { key },
        'Unable to reserve the key'
      )
      throw new BadRequest('Invalid key')
    }

    return rows[0]
  }

  function consumeKey(key) {
    return server.pg.write.query(consume(key))
  }

  function freeKey(key) {
    return server.pg.write.query(free(key))
  }

  async function isKeyAvailable(key) {
    const { rows } = await server.pg.read.query(isAvailable(key))
    return rows[0].count !== 0
  }

  async function sendEmail(params) {
    return sqs
      .sendMessage({
        QueueUrl: options.aws.noticesQueueUrl,
        MessageBody: JSON.stringify(params)
      })
      .promise()
  }

  /**
   * Allows users to create a self-isolation notice to others.
   *
   * This is the first step in the process and will create a new record with a unique key and a nonce
   * The nonce is returned to the caller, and should be used when calling the Apple/Google device attestation
   * checks which will give them some deviceVerificationPayload.
   *
   * See schema.js/create for details on the input/output structure.
   *
   * All requests go through authentication which means both the user and device will be verified. This
   * process will prevent random people from submitting notices. Theoretically, only the app
   * can make this call.
   * However, no information about the user is used in generting the unique key.
   *
   * There are three rate limit modes, depending on configured settings:
   *  NOTICES_RATE_LIMIT_SECS is not set: a user is allowed to request a single notice key, ever
   *  NOTICES_RATE_LIMIT_SECS == 0: a user is allowed to request notice keys with no rate limiting
   *  NOTICES_RATE_LIMIT_SECS > 0: notice key requests are rate limited to one every NOTICES_RATE_LIMIT_SECS seconds
   *
   * Responses:
   *  200: A new unique key for the notice has been generated.
   *  429: Rate limit reached.
   */
  server.route({
    method: 'POST',
    url: '/notices/create',
    schema: schema.create,
    handler: async request => {
      const { id } = request.authenticate()

      await checkRateLimit(id)

      const nonce = await createNewNotice()

      return { nonce }
    }
  })

  /**
   * Allows users to create a self-isolation notice to others.
   *
   * This is the second step.
   * The endpoint must be provided the the nonce from the previous endoint
   * and the deviceVerificationPayload from the Google/Apple api.
   * The nonce is used to lookup the notices record in the database, and the deviceVerificationPayload is verified. If both of
   * those checks the record is updated with the self isolation end date and the unique key will be returned to the caller
   * The called can use the unique key to send a self-isolation certificate
   *
   * See schema.js/verify for details on the input/output structure.
   *
   * All requests go through authentication which means both the user and device will be verified. This
   * process will prevent random people from submitting notices. Theoretically, only the app
   * can make this call.
   * However, no information about the user is used in generting the unique key.
   *
   * Responses:
   *  200: A new unique key for the notice has been generated.
   *  400: Validation error.
   *  404: Nonce not found.
   */
  server.route({
    method: 'PUT',
    url: '/notices/create',
    schema: schema.verify,
    handler: async request => {
      request.authenticate()

      const { selfIsolationEndDate, nonce } = request.body

      const { id: key } = await getKeyFromNonce(nonce)

      await request.verify(nonce)

      await makeKeyAvailable(key, selfIsolationEndDate)

      await server.pg.write.query(
        metricsInsert({
          event: 'NOTICES_GENERATED',
          os: '',
          version: '',
          timeZone: options.timeZone
        })
      )

      return { key }
    }
  })

  /**
   * Allows clients to validate a unique key
   *
   * This is an optional first step in the process to send a self-isolation notice.
   *
   * See schema.js/validate for details on the input/output structure.
   *
   * Requests do not go through authentication which means the endpoint is open for anyone to use.
   *
   * Responses:
   *  200: Status of the key, valid:true if the key exists and has not been used, valid:false if the key either
   *       does not exist or has already been reserved or used.
   */
  server.route({
    method: 'POST',
    url: '/notices/validate',
    schema: schema.validate,
    handler: async request => {
      const { key } = request.body

      const valid = await isKeyAvailable(key)

      return { valid }
    }
  })

  /**
   * Allows users to send a self-isolation notice
   *
   * This the last step in the process and will enqueue the mail for sending.
   *
   * NOTE: Within the AWS notices queue the sender email, full name and unique key are stored together.
   * This should not be PII issue as the unique key has no link with user ids.
   * The implementation of the code reading off that AWS notices queue should also not store
   * the user email and full name.
   *
   * See schema.js/send for details on the input/output structure.
   *
   * Requests do not go through authentication which means the endpoint is open for anyone to use.
   * However, a valid unique key must be provided. If the key isn't provided or it is invalid or already used
   * the request will fail and no email will be sent.
   *
   * Responses:
   *  204: The email has been enqueued and the unique key invalidated.
   *  400: The key is not valid or has already been used. (Also: validation errors)
   */
  server.route({
    method: 'POST',
    url: '/notices/send',
    schema: schema.send,
    handler: async (request, response) => {
      const key = request.body.key

      const data = await reserveKeyIfAvailable(request.log, key)

      try {
        await sendEmail({
          ...request.body,
          date: data.endDate
        })
      } catch (err) {
        try {
          await freeKey(key)
        } catch {}
        throw err
      }

      await consumeKey(key)

      await server.pg.write.query(
        metricsInsert({
          event: 'NOTICES_SEND_REQUEST',
          os: '',
          version: '',
          timeZone: options.timeZone
        })
      )

      response.status(204)
    }
  })
}

module.exports = fp(notices)
