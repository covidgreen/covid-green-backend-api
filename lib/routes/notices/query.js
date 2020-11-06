const SQL = require('@nearform/sql')

function insert(nonce) {
  return SQL`
    INSERT INTO notices (nonce) VALUES (${nonce})
    RETURNING id
  `
}

function selectByNonce(nonce) {
  return SQL`SELECT id FROM notices WHERE nonce = ${nonce} AND status = 'unverified'`
}

function makeAvailable(id, endDate) {
  return SQL`
    UPDATE notices SET
    status = 'available',
    nonce = NULL,
    self_isolation_end_date = ${endDate}
    WHERE id = ${id}
    AND status = 'unverified'
  `
}

function reserve(id) {
  return SQL`
    UPDATE notices
    SET status = 'reserved'
    WHERE id = ${id}
    AND status = 'available'
    RETURNING self_isolation_end_date AS "endDate"
  `
}

function consume(id) {
  return SQL`
    UPDATE notices
    SET status = 'used'
    WHERE id = ${id}
  `
}

function free(id) {
  return SQL`
    UPDATE notices
    SET status = 'available'
    WHERE id = ${id}
    AND status = 'reserved'
  `
}

function isAvailable(id) {
  return SQL`
    SELECT COUNT(id)::int AS count
    FROM notices
    WHERE id = ${id}
    AND status = 'available'`
}

/**
 * If the registrationId has not requested a notice within the last rateLimitSeconds period,
 * it is updated as follows:
 *  last_notice = CURRENT_TIMESTAMP
 *
 * Returns an object of { rowCount } where rowCount is 0 if no update was made or 1 if an
 * update was made.
 */
function registerRateLimitedNotice({ registrationId, rateLimitSeconds }) {
  return SQL`
    UPDATE  registrations
    SET     last_notice = CURRENT_TIMESTAMP
    WHERE   id = ${registrationId}
      AND   (    last_notice IS NULL
              OR last_notice <= CURRENT_TIMESTAMP - ${`${rateLimitSeconds} secs`}::INTERVAL
            )
    RETURNING id`
}

module.exports = {
  registerRateLimitedNotice,
  isAvailable,
  insert,
  selectByNonce,
  makeAvailable,
  reserve,
  consume,
  free
}
