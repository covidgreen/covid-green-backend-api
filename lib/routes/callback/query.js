const SQL = require('@nearform/sql')

/**
 * If the id has not already requested a callback then the last_callback cell is updated with the
 * current timestamp.
 *
 * Returns an object of { rowCount } where rowCount is 0 if no update was made or 1 if an
 * update was made.
 */
const registerUpdate = ({ id }) =>
  SQL`UPDATE registrations
      SET last_callback = CURRENT_TIMESTAMP
      WHERE id = ${id} AND last_callback IS NULL
      RETURNING id`

module.exports = { registerUpdate }
