const S = require('fluent-schema')

const create = {
  body: S.object()
    .prop('receiverEmail', S.string().required())
    .prop('receiverFirstName', S.string().required())
    .prop('receiverSurname', S.string().required())
    .prop('venueType', S.string().required())
    .prop('venueName', S.string().required())
    .prop('venueAddress', S.string().required())
    .prop('venueLocation', S.array().items(S.number()).minItems(2).maxItems(2))
    .prop('contactEmail', S.string().format(S.FORMATS.EMAIL).required())
    .prop('contactPhone', S.string().required()),
  response: {
    204: S.null()
  }
}

const email = {
  body: S.object().prop('emailAddress', S.string().format('email').required()),
  response: {
    204: S.null()
  }
}

const risky = {
  response: {
    200: S.object().prop(
      'riskyVenues',
      S.array().items(
        S.object()
          .prop('id', S.string().required())
          .prop('from', S.string().format('date-time').required())
          .prop('to', S.string().format('date-time').required())
      )
    )
  }
}

const types = {
  response: {
    200: S.object().prop(
      'venueTypes',
      S.array().items(
        S.object()
          .prop('id', S.string().required())
          .prop('name', S.string().required())
          .prop('details', S.string().required())
      )
    )
  }
}

const upload = {
  body: S.object()
    .prop('token', S.string().format('uuid').required())
    .prop(
      'venues',
      S.array()
        .items(
          S.object()
            .prop('id', S.string().format('uuid').required())
            .prop('date', S.string().format('date-time').required())
        )
        .required()
    )
    .prop('platform', S.string().enum(['android', 'ios', 'test']).required())
    .prop('deviceVerificationPayload', S.string().required()),
  response: {
    204: S.null()
  }
}

const verify = {
  body: S.object()
    .prop('emailAddress', S.string().format('email').required())
    .prop('verificationCode', S.string().required()),
  response: {
    200: S.object().prop('token', S.string().required())
  }
}

module.exports = {
  create,
  email,
  risky,
  types,
  upload,
  verify
}
