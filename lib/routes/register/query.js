const SQL = require('@nearform/sql')

const refreshSelect = ({ id }) =>
  SQL`SELECT refresh FROM registrations WHERE id = ${id}`

const refreshUpdate = ({ id }) =>
  SQL`UPDATE registrations
      SET last_refresh = CURRENT_TIMESTAMP
      WHERE id = ${id}`

const registerDelete = ({ id }) =>
  SQL`DELETE FROM registrations
      WHERE id = ${id}`

const registerInsert = ({ nonce }) =>
  SQL`INSERT INTO registrations (nonce)
      VALUES (${nonce})`

const registerSelect = ({ nonce }) =>
  SQL`SELECT id FROM registrations WHERE nonce = ${nonce}`

const registerUpdate = ({ id, refresh }) =>
  SQL`UPDATE registrations
      SET refresh = ${refresh}, nonce = NULL, last_refresh = CURRENT_TIMESTAMP
      WHERE id = ${id}`

module.exports = {
  refreshSelect,
  refreshUpdate,
  registerDelete,
  registerInsert,
  registerSelect,
  registerUpdate
}
