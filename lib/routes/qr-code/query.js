const SQL = require('@nearform/sql')

const emailAddressInsert = ({ emailAddress, verificationCode }) =>
  SQL`INSERT INTO email_addresses (email_address, verification_code)
      VALUES (${emailAddress}, ${verificationCode})
      RETURNING id`

const emailAddressSelect = ({ lifetime, verificationCode }) =>
  SQL`SELECT id, email_address AS "encryptedEmail"
      FROM email_addresses
      WHERE verification_code = ${verificationCode}
      AND created_at >= CURRENT_TIMESTAMP - ${`${lifetime} mins`}::INTERVAL`

const emailAddressDelete = ({ id }) =>
  SQL`DELETE FROM email_addresses
      WHERE id = ${id}`

const qrCodeInsert = ({
  venueType,
  venueName,
  venueAddress,
  contactEmail,
  contactPhone
}) =>
  SQL`
    INSERT INTO qr_code (
      venue_type,
      venue_name,
      venue_address,
      contact_email,
      contact_phone
    )
    VALUES (
      ${venueType},
      ${venueName},
      ${venueAddress},
      ${contactEmail},
      ${contactPhone}
    )
    RETURNING id
  `

const riskyVenueSelect = () =>
  SQL`SELECT venue_id AS "id", start_time AS "from", end_time AS "to"
      FROM risky_venues
      WHERE start_time <= CURRENT_TIMESTAMP
      AND end_time >= CURRENT_TIMESTAMP`

const venueTypesSelect = () =>
  SQL`SELECT *
      FROM venue_types`

const venuesSelect = () =>
  SQL`SELECT
        qr_code.id,
        venue_name AS "name",
        venue_address AS "address",
        start_time as "start",
        end_time as "end"
      FROM qr_code
      LEFT JOIN risky_venues
      ON qr_code.id = risky_venues.venue_id`

const riskyVenueInsert = ({ id, start, end }) =>
  SQL`
    INSERT INTO risky_venues (
      venue_id,
      start_time,
      end_time
    )
    VALUES (
      ${id},
      ${start},
      ${end}
    )
    RETURNING id
  `

const riskyVenueDelete = ({ id }) =>
  SQL`
    DELETE FROM risky_venues WHERE ${id} = venue_id RETURNING id
  `

const riskyVenueUpdate = ({ id, start = null, end = null }) =>
  SQL`
    UPDATE risky_venues
    SET start_time = COALESCE(${start}, start_time),
        end_time = COALESCE(${end}, end_time)
    WHERE venue_id = ${id};
  `

module.exports = {
  emailAddressInsert,
  emailAddressSelect,
  emailAddressDelete,
  qrCodeInsert,
  riskyVenueSelect,
  venueTypesSelect,
  venuesSelect,
  riskyVenueInsert,
  riskyVenueDelete,
  riskyVenueUpdate
}
