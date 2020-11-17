const SQL = require('@nearform/sql')

/**
 * If the registrationId has not already requested a callback then the last_callback cell is updated with the
 * current timestamp.
 *
 * Returns an object of { rowCount } where rowCount is 0 if no update was made or 1 if an
 * update was made.
 */
const registerOnetimeCallback = ({ registrationId }) =>
  SQL`UPDATE registrations
      SET last_callback = CURRENT_TIMESTAMP
      WHERE id = ${registrationId} AND last_callback IS NULL
      RETURNING id`

/**
 * If the registrationId has not requested a callback within the last rateLimitSeconds period, or
 * they have but they haven't requested more than rateLimitRequestCount then the registration record
 * is updated as follows:
 *  last_callback = CURRENT_TIMESTAMP
 *  callback_rate_count is set to 1 if not within rate limit, or incremented if within rate limit
 *  callback_request_total is incremented
 *
 * Returns an object of { rowCount } where rowCount is 0 if no update was made or 1 if an
 * update was made.
 */
const registerRateLimitedCallback = ({
  registrationId,
  rateLimitSeconds,
  rateLimitRequestCount
}) =>
  SQL`UPDATE  registrations
      SET     last_callback = CURRENT_TIMESTAMP,
              callback_rate_count = CASE
                WHEN last_callback IS NULL OR last_callback <= CURRENT_TIMESTAMP - ${`${rateLimitSeconds} secs`}::INTERVAL THEN 1
                WHEN callback_rate_count < ${rateLimitRequestCount} THEN callback_rate_count + 1
                ELSE callback_rate_count
              END,
              callback_request_total = CASE
                WHEN callback_request_total IS NULL THEN 1
                ELSE callback_request_total + 1
               END
      WHERE   id = ${registrationId}
        AND   (    last_callback IS NULL
                OR last_callback <= CURRENT_TIMESTAMP - ${`${rateLimitSeconds} secs`}::INTERVAL
                OR callback_rate_count < ${rateLimitRequestCount}
              )
      RETURNING id`

module.exports = {
  registerOnetimeCallback,
  registerRateLimitedCallback
}
