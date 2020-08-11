const SQL = require('@nearform/sql')

/**
 * Insert into the metrics table a new record with the event, device OS, and App version with a value of 1.
 * If a row already exists for the event, OS, and version then the value is incremented. This is allowing
 * us to track how often specific events are occurring on specific OS and App version instances. This does
 * not track any user identifying information.
 */
const metricsInsert = ({ event, os, version }) =>
  SQL`INSERT INTO metrics (date, event, os, version, value)
      VALUES (CURRENT_DATE, ${event}, ${os}, ${version}, 1)
      ON CONFLICT ON CONSTRAINT metrics_pkey
      DO UPDATE SET value = metrics.value + 1`

const payloadInsert = ({ event, payload }) =>
  SQL`INSERT INTO metrics_payloads (event, payload)
      VALUES (${event}, ${payload})`

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

module.exports = { metricsInsert, payloadInsert, requestInsert }
