const S = require('fluent-schema')

const key = S.string()
  .format('uuid')
  .required()

const create = {
  response: {
    200: S.object().prop('nonce', S.string().required())
  }
}

const verify = {
  body: S.object()
    .prop(
      'selfIsolationEndDate',
      S.string()
        .format(S.FORMATS.DATE)
        .required()
    )
    .prop('nonce', S.string().required())
    .prop(
      'platform',
      S.string()
        .enum(['android', 'ios', 'test'])
        .required()
    )
    .prop('deviceVerificationPayload', S.string().required())
    .prop('timestamp', S.number()),
  response: {
    200: S.object().prop('key', key)
  }
}

const send = {
  body: S.object()
    .prop('key', key)
    .prop('senderFullName', S.string().required())
    .prop(
      'senderEmail',
      S.string()
        .format(S.FORMATS.EMAIL)
        .required()
    )
    .prop(
      'recipients',
      S.array()
        .items(S.string().format(S.FORMATS.EMAIL))
        .minItems(1)
        .maxItems(40)
        .required()
    )
    .prop('sendToAdmin', S.boolean()),
  response: {
    204: S.null()
  }
}

const validate = {
  body: S.object().prop('key', key),
  response: {
    200: S.object().prop('valid', S.boolean().required())
  }
}

module.exports = {
  create,
  send,
  verify,
  validate
}
