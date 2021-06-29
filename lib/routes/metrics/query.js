const SQL = require('@nearform/sql')

/**
 * Insert into the metrics table a new record with the event, device OS, and App version with a value of 1.
 * If a row already exists for the event, OS, and version then the value is incremented. This is allowing
 * us to track how often specific events are occurring on specific OS and App version instances. This does
 * not track any user identifying information.
 */
const metricsInsert = ({ event, os, timeZone, version }) =>
  SQL`INSERT INTO metrics (date, event, os, version, value)
      VALUES ((CURRENT_TIMESTAMP AT TIME ZONE ${timeZone})::DATE, ${event}, ${os}, ${version}, 1)
      ON CONFLICT ON CONSTRAINT metrics_pkey
      DO UPDATE SET value = metrics.value + 1`

const metricsInsertValue = ({ event, os, timeZone, version, value }) =>
  SQL`INSERT INTO metrics (date, event, os, version, value)
      VALUES ((CURRENT_TIMESTAMP AT TIME ZONE ${timeZone})::DATE, ${event}, ${os}, ${version}, ${value})
      ON CONFLICT ON CONSTRAINT metrics_pkey
      DO UPDATE SET value = metrics.value + ${value}`

const payloadInsert = ({ event, payload, timeZone }) =>
  SQL`INSERT INTO metrics_payloads (created_at, event, payload)
      VALUES (CURRENT_TIMESTAMP AT TIME ZONE ${timeZone}, ${event}, ${payload})`

const updateAverageAgeMetric = () =>
  SQL`INSERT INTO metrics (date, event, os, version, value) SELECT a.date, 'OTC_AVG_AGE', '', '', a.value / b.value FROM
        (SELECT date, value FROM metrics WHERE event = 'OTC_TOTAL_AGE') as a INNER JOIN ((SELECT date, value FROM metrics WHERE event = 'OTC_VALID')) as b
          ON a.date = b.date
      ON CONFLICT ON CONSTRAINT metrics_pkey
      DO UPDATE SET value = Excluded.value
      WHERE metrics.date = Excluded.date
      AND metrics.event = Excluded.event`

/**
 * Inserts into the metrics_requests table that a user is attempting to submit a metric event. If a record
 * for that user & event already exist then we will check if the last_request timestamp is greater than
 * limit minutes back. If it is then we'll update the last_request timestamp to CURRENT_TIMESTAMP. If not
 * then we keep the last_request timestamp as it is. Then we return the last_request timestamp so the caller
 * can decide what to do with it.
 *
 * Current implementation means that if the last_request timestamp was changed then the metric data will
 * be saved in the metrics table.
 */
const requestInsert = ({ event, id, limit }) =>
  SQL`WITH previous AS (
        SELECT last_request FROM metrics_requests
        WHERE reg_id = ${id} AND event = ${event}
      )
      INSERT INTO metrics_requests (reg_id, event, last_request)
      VALUES (${id}, ${event}, CURRENT_TIMESTAMP)
      ON CONFLICT ON CONSTRAINT metrics_requests_pkey
      DO UPDATE SET last_request = CASE
        WHEN metrics_requests.last_request < CURRENT_TIMESTAMP - ${`${limit} secs`}::INTERVAL
        THEN CURRENT_TIMESTAMP
        ELSE metrics_requests.last_request
      END
      RETURNING (SELECT last_request FROM previous) AS "lastRequest"`

const dccInsert = ({ payload }) => {
  const query = SQL`INSERT INTO dcc_stats (event_date, app_location, cert_type, scan_passed, failure_reason, issuing_country)
      VALUES ${SQL.glue(
        payload.map((i, index) => {
          return SQL`(${i.datetime}, ${i.location}, ${i.type}, ${i.passed}, ${
            i.failure || null
          }, ${i.country})`
        }),
        ','
      )}`

  console.log(query.text)
  return query
}
module.exports = {
  metricsInsert,
  payloadInsert,
  requestInsert,
  metricsInsertValue,
  updateAverageAgeMetric,
  dccInsert
}
