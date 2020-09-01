const SQL = require('@nearform/sql')

/**
 * If the id has not already checked in on the same day then insert a new check in record.
 *
 * Returns an object of { rowCount } where rowCount is 0 if no insert was made or 1 if an
 * insert was made.
 */
const checkInInsert = ({ id, ok, data, demographics }) =>
  SQL`WITH updated AS (
        UPDATE registrations
        SET last_check_in = CURRENT_DATE
        WHERE id = ${id} AND (
          last_check_in IS NULL OR
          last_check_in < CURRENT_DATE
        )
        RETURNING id
      )
      INSERT INTO check_ins (ok, payload, demographics)
      SELECT
        ${ok === null || ok === undefined ? true : ok},
        ${{ data }},
        ${demographics}
      FROM updated
      RETURNING id`

module.exports = { checkInInsert }
