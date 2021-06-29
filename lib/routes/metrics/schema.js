const S = require('fluent-schema')

const event = (options) => ({
  body: S.object()
    .prop('event', S.string().enum(Object.keys(options.metrics)).required())
    .prop('os', S.string().enum(['android', 'ios']).required())
    .prop('version', S.string()),
  response: {
    204: S.null()
  }
})

const dcc = () => ({
  body: S.array().items(
    S.object()
      .prop('datetime', S.string().format('date-time').required())
      .prop('location', S.string().required())
      .prop('type', S.string().enum(['recovery', 'test', 'vaccine']).required())
      .prop('passed', S.boolean().required())
      .prop('failure', S.string())
      .prop('country', S.string().maxLength(2).required())
      .prop('uvci', S.string())
  ),
  response: {
    204: S.null()
  }
})
module.exports = { event, dcc }