const SQL = require('@nearform/sql')

const exposureInsert = ({ exposures, regions, testType }) => {
  const query = SQL`INSERT INTO exposures (key_data, rolling_period, rolling_start_number, transmission_risk_level, regions, test_type) VALUES `

  for (const [
    index,
    { key, rollingPeriod, rollingStartNumber, transmissionRiskLevel }
  ] of exposures.entries()) {
    query.append(
      SQL`(
        ${key},
        ${rollingPeriod},
        ${rollingStartNumber},
        ${transmissionRiskLevel},
        ${regions},
        ${testType}
      )`
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

const exposureSelect = ({ since, region }) =>
  SQL`SELECT id, path
      FROM exposure_export_files
      WHERE region = ${region}
      AND first_exposure_created_at >= CURRENT_TIMESTAMP - INTERVAL '14 days'
      AND since_exposure_id >= (
        SELECT COALESCE(MAX(last_exposure_id), 0)
        FROM exposure_export_files
        WHERE id = ${since} AND region = ${region}
      )
      ORDER BY since_exposure_id ASC, exposure_count DESC
      LIMIT 1`

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
      RETURNING created_at AS "createdAt", onset_date AS "onsetDate", test_type AS "testType"`

const tokenInsert = ({ id, onsetDate, testType }) =>
  SQL`INSERT INTO upload_tokens (reg_id, onset_date, test_type)
      VALUES (${id}, ${onsetDate}, ${testType})
      RETURNING id`

const verificationDelete = ({ control, code }) =>
  SQL`DELETE FROM verifications
      WHERE control = ${control}
      AND code = ${code}
      RETURNING id, created_at AS "createdAt", onset_date AS "onsetDate", test_type AS "testType"`

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
