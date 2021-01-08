const SQL = require('@nearform/sql')

const checkInInsert = ({ venues }) => {
  const query = SQL`INSERT INTO venue_check_ins (venue_id, checked_in_at) VALUES `

  for (const [index, { id, date }] of venues.entries()) {
    query.append(SQL`(${id}, ${date})`)

    if (index < venues.length - 1) {
      query.append(SQL`, `)
    }
  }

  return query
}

const emailAddressDelete = ({ id }) =>
  SQL`DELETE FROM email_addresses
      WHERE id = ${id}`

const emailAddressInsert = ({ emailAddress, verificationCode }) =>
  SQL`INSERT INTO email_addresses (email_address, verification_code)
      VALUES (${emailAddress}, ${verificationCode})
      RETURNING id`

const emailAddressSelect = ({ lifetime, verificationCode }) =>
  SQL`SELECT id, email_address AS "encryptedEmail"
      FROM email_addresses
      WHERE verification_code = ${verificationCode}
      AND created_at >= CURRENT_TIMESTAMP - ${`${lifetime} mins`}::INTERVAL`

const venueInsert = ({
  venueType,
  venueName,
  venueAddress,
  venueLocation,
  contactEmail,
  contactPhone
}) =>
  SQL`INSERT INTO qr_code (
        venue_type,
        venue_name,
        venue_address,
        location,
        contact_email,
        contact_phone
      )
      VALUES (
        ${venueType},
        ${venueName},
        ${venueAddress},
        ${venueLocation ? `(${venueLocation[1]}, ${venueLocation[0]})` : null},
        ${contactEmail},
        ${contactPhone}
      )
      RETURNING id`

const riskyVenueSelect = () =>
  SQL`SELECT venue_id AS "id", start_time AS "from", end_time AS "to"
      FROM risky_venues`

const typesSelect = () =>
  SQL`SELECT id, name, details
      FROM venue_types`

const tokenUpdate = ({ id, token }) =>
  SQL`UPDATE upload_tokens
      SET venues_uploaded = CURRENT_TIMESTAMP
      WHERE reg_id = ${id} AND id = ${token} AND venues_uploaded IS NULL
      RETURNING created_at AS "createdAt", onset_date AS "onsetDate", test_type AS "testType"`

module.exports = {
  checkInInsert,
  emailAddressDelete,
  emailAddressInsert,
  emailAddressSelect,
  riskyVenueSelect,
  tokenUpdate,
  typesSelect,
  venueInsert
}
