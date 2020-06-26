const SQL = require('@nearform/sql')

const checkInInsert = ({ id, ageRange, locality, ok, sex, data }) =>
  SQL`WITH updated AS (
        UPDATE registrations
        SET last_check_in = CURRENT_DATE
        WHERE id = ${id} AND (
          last_check_in IS NULL OR
          last_check_in < CURRENT_DATE
        )
        RETURNING id
      )
      INSERT INTO check_ins (age_range, locality, ok, sex, payload)
      SELECT ${ageRange}, ${locality}, ${ok}, ${sex}, ${{ data }} FROM updated
      RETURNING id`

module.exports = { checkInInsert }
