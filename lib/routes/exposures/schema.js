const S = require('fluent-schema')

const certificate = {
  body: S.object()
    .prop('ekeyhmac', S.string().minLength(44).maxLength(44))
    .prop('token', S.string())
    .prop('padding', S.string()),
  response: {
    200: S.object()
      .prop('certificate', S.string())
      .prop('error', S.string())
      .prop('padding', S.string().required())
  }
}

const exchange = {
  body: S.object()
    .prop('code', S.string().required())
    .prop('padding', S.string()),
  response: {
    200: S.object()
      .prop('testtype', S.string().enum(['confirmed', 'likely', 'negative']))
      .prop('symptomDate', S.string().format('date'))
      .prop('token', S.string())
      .prop('error', S.string())
      .prop('padding', S.string().required())
  }
}

const list = {
  query: S.object()
    .prop('limit', S.number())
    .prop('since', S.number())
    .prop('regions', S.string().pattern(/^[A-Z]{2}(,[A-Z]{2})*$/)),
  response: {
    200: S.array().items(
      S.object()
        .prop('id', S.number().required())
        .prop('path', S.string().required())
    )
  }
}

const temporaryExposureKey = S.object()
  .oneOf([
    S.object().prop('key', S.string().required()),
    S.object().prop('keyData', S.string().required())
  ])
  .oneOf([
    S.object().prop(
      'transmissionRisk',
      S.number().minimum(0).maximum(8).required()
    ),
    S.object().prop(
      'transmissionRiskLevel',
      S.number().minimum(0).maximum(8).required()
    )
  ])
  .prop('rollingStartNumber', S.number().required())
  .prop('rollingPeriod', S.number().minimum(1).maximum(144))

const uploadBody = S.object()
  .oneOf([
    S.object().prop('token', S.string().format('uuid').required()),
    S.object()
      .prop('appPackageName', S.string())
      .prop('hmackey', S.string().required())
      .prop('verificationPayload', S.string().required())
  ])
  .oneOf([
    S.object().prop(
      'exposures',
      S.array().items(temporaryExposureKey).required()
    ),
    S.object().prop(
      'temporaryExposureKeys',
      S.array().items(temporaryExposureKey).required()
    )
  ])
  .prop(
    'platform',
    S.string().enum(['android', 'ios', 'recaptcha', 'test']).required()
  )
  .prop('deviceVerificationPayload', S.string().required())
  .prop('regions', S.array().items(S.string().pattern(/[A-Z]{2}/)))
  .prop('padding', S.string())

const publish = {
  body: uploadBody,
  response: {
    200: S.object()
      .prop('insertedExposures', S.number())
      .prop('error', S.string())
      .prop('padding', S.string().required())
  }
}

const upload = {
  body: uploadBody,
  response: {
    204: S.null()
  }
}

const verify = {
  body: S.object()
    .prop('hash', S.string().pattern(/[a-z0-9]{256}/))
    .prop('padding', S.string()),
  response: {
    200: S.object()
      .prop('token', S.string().format('uuid').required())
      .prop('padding', S.string().required())
  }
}

module.exports = { certificate, exchange, list, publish, upload, verify }
