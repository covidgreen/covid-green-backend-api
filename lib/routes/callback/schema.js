const S = require('fluent-schema')

const callback = {
  body: S.object()
    .prop('closeContactDate', S.number().required())
    .prop(
      'mobile',
      S.string()
        .pattern(/^\+?[0-9]{7,15}$/)
        .required()
    )
    .prop('payload', S.object()),
  response: {
    204: S.null()
  }
}

module.exports = { callback }
