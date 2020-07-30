const S = require('fluent-schema')

const forget = {
  response: {
    204: S.null()
  }
}

const refresh = {
  response: {
    200: S.object().prop('token', S.string().required())
  }
}

const register = {
  response: {
    200: S.object().prop('nonce', S.string().required())
  }
}

const verify = {
  body: S.object()
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
    200: S.object()
      .prop('refreshToken', S.string().required())
      .prop('token', S.string().required())
  }
}

module.exports = { forget, refresh, register, verify }
