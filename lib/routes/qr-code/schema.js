const S = require('fluent-schema')

const create = {
  body: S.object()
    .prop('receiverEmail', S.string().required())
    .prop('receiverFirstName', S.string().required())
    .prop('receiverSurname', S.string().required())
    .prop('venueType', S.string().required())
    .prop('venueName', S.string().required())
    .prop('venueAddress', S.string().required())
    .prop(
      'contactEmail',
      S.string()
        .format(S.FORMATS.EMAIL)
        .required()
    )
    .prop('contactPhone', S.string().required()),
  response: {
    204: S.null()
  }
}

const email = {
  body: S.object().prop(
    'emailAddress',
    S.string()
      .format('email')
      .required()
  ),
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
          .prop(
            'from',
            S.string()
              .format('date-time')
              .required()
          )
          .prop(
            'to',
            S.string()
              .format('date-time')
              .required()
          )
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

const verify = {
  body: S.object()
    .prop(
      'emailAddress',
      S.string()
        .format('email')
        .required()
    )
    .prop('verificationCode', S.string().required()),
  response: {
    200: S.object().prop('token', S.string().required())
  }
}

const venues = {
  response: {
    200: S.object().prop(
      'venues',
      S.array().items(
        S.object()
          .prop('id', S.string().required())
          .prop('name', S.string().required())
          .prop('address', S.string().required())
          .prop('start', S.string().raw({ nullable: true }))
          .prop('end', S.string().raw({ nullable: true }))
      )
    )
  }
}

const flagRisky = {
  body: S.object()
    .prop('id', S.string().required())
    .prop('start', S.string().required())
    .prop('end', S.string().required()),
  response: {
    204: S.null()
  }
}

const removeRisky = {
  body: S.object().prop('id', S.string().required()),
  response: {
    204: S.null()
  }
}

const updateRisky = {
  body: S.object()
    .prop('id', S.string().required())
    .prop('start', S.string())
    .prop('end', S.string()),
  response: {
    204: S.null()
  }
}

module.exports = {
  create,
  email,
  risky,
  types,
  verify,
  venues,
  flagRisky,
  removeRisky,
  updateRisky
}
