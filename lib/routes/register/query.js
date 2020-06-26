const SQL = require('@nearform/sql')

const registerDelete = ({ id }) =>
  SQL`DELETE FROM registrations
      WHERE id = ${id}`

const registerInsert = ({ nonce }) =>
  SQL`INSERT INTO registrations (nonce)
      VALUES (${nonce})`

const refreshSelect = ({ id }) =>
  SQL`SELECT refresh FROM registrations WHERE id = ${id}`

const registerSelect = ({ nonce }) =>
  SQL`SELECT id FROM registrations WHERE nonce = ${nonce}`

const registerUpdate = ({ id, refresh }) =>
  SQL`UPDATE registrations
      SET refresh = ${refresh}, nonce = NULL
      WHERE id = ${id}`

module.exports = {
  registerDelete,
  registerInsert,
  refreshSelect,
  registerSelect,
  registerUpdate
}
