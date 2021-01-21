const SQL = require('@nearform/sql')

const exposureInsert = ({ exposures, regions, testType }) => {
  const query = SQL`INSERT INTO exposures (key_data, rolling_period, rolling_start_number, transmission_risk_level, regions, test_type, days_since_onset) VALUES `

  for (const [
    index,
    {
      daysSinceOnset,
      key,
      rollingPeriod,
      rollingStartNumber,
      transmissionRiskLevel
    }
  ] of exposures.entries()) {
    query.append(
      SQL`(
        ${key},
        ${rollingPeriod},
        ${rollingStartNumber},
        ${transmissionRiskLevel},
        ${regions},
        ${testType},
        ${daysSinceOnset}
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
      AND first_exposure_created_at >= CURRENT_DATE - INTERVAL '14 days'
      AND since_exposure_id > (
        SELECT COALESCE(MAX(last_exposure_id), 0)
        FROM exposure_export_files
        WHERE id = ${since} AND region = ${region}
      )
      ORDER BY since_exposure_id ASC, exposure_count DESC
      LIMIT 1`

const minimumSelect = ({ region }) =>
  SQL`SELECT MIN(id) AS "earliest"
      FROM exposure_export_files
      WHERE region = ${region}
      AND first_exposure_created_at >= CURRENT_DATE - INTERVAL '14 days'`

const registerUpdate = ({ id, rateLimit }) =>
  SQL`UPDATE registrations
      SET last_verification_attempt = CURRENT_TIMESTAMP
      WHERE id = ${id} AND (
        last_verification_attempt IS NULL OR
        last_verification_attempt < CURRENT_TIMESTAMP - ${`${rateLimit} secs`}::INTERVAL
      )
      RETURNING id`

const tokenUpdate = ({ id, token }) =>
  SQL`UPDATE upload_tokens
      SET exposures_uploaded = CURRENT_TIMESTAMP
      WHERE reg_id = ${id} AND id = ${token} AND exposures_uploaded IS NULL
      RETURNING created_at AS "createdAt", onset_date AS "onsetDate", test_type AS "testType"`

const tokenInsert = ({ id, onsetDate, testType }) =>
  SQL`INSERT INTO upload_tokens (reg_id, onset_date, test_type)
      VALUES (${id}, ${onsetDate}, ${testType})
      RETURNING id`

const verificationDelete = ({ verificationId }) =>
  SQL`DELETE FROM verifications
      WHERE id = ${verificationId}`

const verificationSelect = ({ code }) =>
  SQL`SELECT
        id AS "verificationId",
        last_updated_at AS "lastUpdatedAt",
        onset_date AS "onsetDate",
        test_type AS "testType",
        send_count AS "sendCount"
      FROM verifications
      WHERE code = ${code}`

module.exports = {
  exposureInsert,
  exposureSelect,
  minimumSelect,
  registerUpdate,
  tokenInsert,
  tokenUpdate,
  verificationDelete,
  verificationSelect
}
