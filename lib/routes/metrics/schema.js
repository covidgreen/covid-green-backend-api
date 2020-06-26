const S = require('fluent-schema')

const event = options => ({
  body: S.object()
    .prop(
      'event',
      S.string()
        .enum(Object.keys(options.metrics))
        .required()
    )
    .prop(
      'os',
      S.string()
        .enum(['android', 'ios'])
        .required()
    )
    .prop(
      'version',
      S.string()
        .pattern(
          /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/
        )
        .required()
    ),
  response: {
    204: S.null()
  }
})

module.exports = { event }
