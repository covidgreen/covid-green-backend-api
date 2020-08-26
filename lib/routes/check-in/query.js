const SQL = require('@nearform/sql')

/**
 * If the id has not already checked in on the same day then insert a new check in record.
 *
 * Returns an object of { rowCount } where rowCount is 0 if no insert was made or 1 if an
 * insert was made.
 */
const checkInInsert = ({ id, ageRange, locality, ok, sex, data, additional }) =>
  SQL`WITH updated AS (
        UPDATE registrations
        SET last_check_in = CURRENT_DATE
        WHERE id = ${id} AND (
          last_check_in IS NULL OR
          last_check_in < CURRENT_DATE
        )
        RETURNING id
      )
      INSERT INTO check_ins (age_range, locality, ok, sex, payload, data)
      SELECT
        ${ageRange || null},
        ${locality || null},
        ${ok || true},
        ${sex || null},
        ${{ data }},
        ${additional}
      FROM updated
      RETURNING id`

module.exports = { checkInInsert }
