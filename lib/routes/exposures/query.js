const SQL = require('@nearform/sql')

const exposureInsert = ({ defaultRegion, exposures }) => {
  const query = SQL`INSERT INTO exposures (key_data, rolling_period, rolling_start_number, transmission_risk_level) VALUES `

  for (const [
    index,
    {
      keyData,
      rollingPeriod,
      rollingStartNumber,
      transmissionRiskLevel
    }
  ] of exposures.entries()) {
    query.append(
      SQL`(${keyData}, ${rollingPeriod}, ${rollingStartNumber}, ${transmissionRiskLevel})`
    )

    if (index < exposures.length - 1) {
      query.append(SQL`, `)
    }
  }

  query.append(
    SQL` ON CONFLICT ON CONSTRAINT exposures_key_data_unique DO NOTHING`
  )

  return query
}

const exposureSelect = ({ since, limit }) =>
  SQL`SELECT id, path
      FROM exposure_export_files
      WHERE id > ${since || 0}
      ORDER BY id DESC
      LIMIT ${limit}`

const registerUpdate = ({ id, rateLimit }) =>
  SQL`UPDATE registrations
      SET last_verification_attempt = CURRENT_TIMESTAMP
      WHERE id = ${id} AND (
        last_verification_attempt IS NULL OR
        last_verification_attempt < CURRENT_TIMESTAMP - ${`${rateLimit} secs`}::INTERVAL
      )
      RETURNING id`

const tokenDelete = ({ id, token }) =>
  SQL`DELETE FROM upload_tokens
      WHERE reg_id = ${id} AND id = ${token}
      RETURNING id, onset_date AS "onsetDate"`

const tokenInsert = ({ id, onsetDate }) =>
  SQL`INSERT INTO upload_tokens (reg_id, onset_date)
      VALUES (${id}, ${onsetDate})
      RETURNING id`

const verificationDelete = ({ control, code }) =>
  SQL`DELETE FROM verifications
      WHERE control = ${control}
      AND code = ${code}
      RETURNING id, created_at AS "createdAt", onset_date AS "onsetDate"`

const verificationUpdate = ({ control, rateLimit }) =>
  SQL`UPDATE verifications v
      SET last_attempt = CASE WHEN (
        v.last_attempt IS NULL OR
        v.last_attempt < CURRENT_TIMESTAMP - ${`${rateLimit} secs`}::INTERVAL
      ) THEN CURRENT_TIMESTAMP
      ELSE v.last_attempt END
      FROM verifications o
      WHERE v.id = o.id AND v.control = ${control}
      RETURNING v.id, o.last_attempt AS "lastAttempt"`

module.exports = {
  exposureInsert,
  exposureSelect,
  registerUpdate,
  tokenDelete,
  tokenInsert,
  verificationDelete,
  verificationUpdate
}
