const fp = require('fastify-plugin')
const schema = require('./schema')
const { BadRequest, Forbidden, Gone, TooManyRequests } = require('http-errors')
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
  /**
   * Allows users to validate the verification code they get when given a positive diagnosis. The request contains a
   * 256 character hash made up of two 128 character hashes. The first 128 characters contain a control code while the
   * second 128 character hash contains the actual verification code given to the user.
   *
   * See schema.js/verify for details oon the input/output structure.
   *
   * First, we verify the user is within configured rate limits (same user can't verify more than 1 code per second,
   * regardless of the code value).
   *
   * Next, we verify that the control code is within configured rate limits (the first
   * 3 digits of the code cannot be verified more than once per second). This means that codes 123456 and 123987
   * cannot be verified within the same second, regardless of the user verifying either. This check exists to help
   * limit attacks if someone is registering new user records to bypass user rate limit checks. I don't know how
   * effective such a check will end up being, and it does add a database write. The result of this database call
   * is again checked against rate limiting, but I'm not quite sure why the double check is done - perhaps to
   * protect against slow database connections?
   *
   * Next, we delete the verification record, using both the control and full code to delete only a single record.
   * This call returns when the code record was created and the user's onset date (I assume onset of symptoms). The
   * code TTL is verified to be within the configured lifetime, using .env value `CODE_LIFETIME_MINS`. On dev this
   * is set to CODE_LIFETIME_MINS=10.
   *
   * And finally, the user's ID and onset date is inserted into the upload_tokens table. This call results in the
   * generation of a new upload_token ID value, which is returned to the caller.
   *
   * Responses:
   *  200: Upload token, if everything is successful
   *  403: If the code doesn't exist, or it does exist but the last verification attempt on it was within the
   *    configured rate limit period.
   *  410: If the code is too old
   *  429: If any rate limit checks fail
   */
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

  /**
   * Allows users who've tested positive to submit their Temporary Exposure Keys (TEK) for later distribution.
   *
   * First, we verify the provided token, which I believe is the upload_token ID value.
   * TODO: Get clarification on the call to request.verify with the token
   *
   * Next, the upload_token record is deleted from the upload_tokens table. This means that user can only
   * use an upload_token once. Subsequent uploads are not supported at this time.
   * TODO: This is an APHL issue
   *
   * We then verify that the upload token has been used within its configured lifetime, set via .env variable
   * `UPLOAD_TOKEN_LIFETIME_MINS`, which on dev is set to `UPLOAD_TOKEN_LIFETIME_MINS=1440` (24 hours).
   *
   * We then filter out any TEKs whose lifetime ended before the saved onset date. This ensures that we only
   * public TEKs that were active during or after the user's onset date.
   *
   * And finally we write the TEKs to the database.
   *
   * Responses:
   *  204: Everything was accepted
   *  403: Upload token doesn't exist
   *  410: Upload token is too old
   */
  server.route({
    method: 'POST',
    url: '/exposures',
    schema: schema.upload,
    handler: async (request, response) => {
      const { id } = request.authenticate()

      if (('x-chaff' in request.headers) === false) {
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

        if (exposures.length > options.exposures.maxKeys) {
          throw new BadRequest('Too many keys')
        }

        const filteredExposures = exposures.filter(
          ({ rollingStartNumber, rollingPeriod }) => {
            const startTime = rollingStartNumber * 1000 * 600
            const duration = rollingPeriod * 1000 * 600

            if (isAfter(new Date(startTime), new Date())) {
              throw new BadRequest('Future keys are not accepted')
            }

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
      }

      response.status(204)
    }
  })

  /**
   * Allows users to request a list of all the exposure files that have been generated since they last
   * requested exposure files. The caller includes `since` which is the largest exposure file ID they've
   * seen. Exposure file IDs are sequentially generated by the database, and always count up. So if the
   * user has seen files 1,2,3,4,5 then they'll pass `since = 5` and this will return a list of files
   * with ID > 5.
   *
   * OUTDATED: The user can also include a `limit` value to indicate the number of files they want to receive in
   * the response. If they include `limit=2` then, using the above example, they SHOULD receive a response
   * with files 6 and 7, even if files 8, 9, and 10 exist. They can then make additional requests for
   * files since 7. Rinse and repeat until they have all the files. (NOTE, there is a bug, documented
   * below, causing the user to perhaps not receive all files since they last requested them)
   *
   * CURRENT: The exposure file generation has been modified to generate files such that any particular user
   * only needs to download a single file, regardless of days they may have missed. For example, if today is
   * day 4, and the user has downloaded files 1, 2, and 3 then the user will get a link to a file containing
   * TEKs for day 4. But if the user has downloaded files for days 1 and 2 then the user will get a link to
   * a file containing TEKs for days 3 and 4. And if the user has downloaded files for day 1 only then the
   * user will get a link to a file containing TEKs for days 2, 3, and 4. The file generation process generates
   * all of these options and this endpoint figures out the most appropriate file for the user.
   *
   * Due to this change the `limit` parameter is no longer utilized because users should only get a single
   * file link anyway.
   *
   * The user can also include a list of regions to filter by.
   *
   * Responses:
   *  200: List of files with exposure keys. The list contains the file ID and path. See schema.js/list
   *   for details on the structure.
   */
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
