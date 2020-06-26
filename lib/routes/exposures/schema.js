const S = require('fluent-schema')

const list = {
  query: S.object().prop('since', S.number()),
  response: {
    200: S.array().items(
      S.object()
        .prop('id', S.number().required())
        .prop('path', S.string().required())
    )
  }
}

const upload = {
  body: S.object()
    .prop(
      'token',
      S.string()
        .format('uuid')
        .required()
    )
    .prop(
      'platform',
      S.string()
        .enum(['android', 'ios', 'test'])
        .required()
    )
    .prop('deviceVerificationPayload', S.string().required())
    .prop(
      'exposures',
      S.array().items(
        S.object()
          .prop('keyData', S.string().required())
          .prop('rollingStartNumber', S.number().required())
          .prop('transmissionRiskLevel', S.number().required())
          .prop('rollingPeriod', S.number().required())
      )
    ),
  response: {
    204: S.null(),
    403: S.object()
  }
}

const verify = {
  body: S.object().prop('hash', S.string().pattern(/[a-z0-9]{256}/)),
  response: {
    200: S.object().prop(
      'token',
      S.string()
        .format('uuid')
        .required()
    ),
    403: S.object(),
    429: S.object()
  }
}

module.exports = { list, upload, verify }
