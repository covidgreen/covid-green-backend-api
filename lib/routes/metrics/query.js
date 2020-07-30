const SQL = require('@nearform/sql')

const metricsInsert = ({ event, os, version }) =>
  SQL`INSERT INTO metrics (date, event, os, version, value)
      VALUES (CURRENT_DATE, ${event}, ${os}, ${version}, 1)
      ON CONFLICT ON CONSTRAINT metrics_pkey
      DO UPDATE SET value = metrics.value + 1`

const payloadInsert = ({ event, payload }) =>
  SQL`INSERT INTO metrics_payloads (event, payload)
      VALUES (${event}, ${payload})`

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
