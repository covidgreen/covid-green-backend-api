const SQL = require('@nearform/sql')

const registerUpdate = ({ id }) =>
  SQL`UPDATE registrations
      SET last_callback = CURRENT_TIMESTAMP
      WHERE id = ${id} AND last_callback IS NULL
      RETURNING id`

module.exports = { registerUpdate }
