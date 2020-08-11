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
 * If the registrationId has not requested a callback within the last rateLimitSeconds period then
 * the last_callback cell is updated with the current timestamp.
 *
 * Returns an object of { rowCount } where rowCount is 0 if no update was made or 1 if an
 * update was made.
 */
const registerRateLimitedCallback = ({ registrationId, rateLimitSeconds }) =>
  SQL`UPDATE registrations
      SET last_callback = CURRENT_TIMESTAMP
      WHERE id = ${registrationId} AND (last_callback IS NULL OR last_callback <= last_callback::timestamp - ${`${rateLimitSeconds} secs`}::INTERVAL)
      RETURNING id`

module.exports = {
  registerOnetimeCallback,
  registerRateLimitedCallback
}
