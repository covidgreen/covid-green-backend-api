const S = require('fluent-schema')

const event = options => ({
  body: S.object()
    .prop('event', S.string().enum(Object.keys(options.metrics)).required())
    .prop('os', S.string().enum(['android', 'ios']).required())
    .prop('version', S.string()),
  response: {
    204: S.null()
  }
})

module.exports = { event }
