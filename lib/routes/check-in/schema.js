const S = require('fluent-schema')

const checkIn = {
  body: S.object()
    .prop('ok', S.boolean().required())
    .prop('ageRange', S.anyOf([S.null(), S.string().maxLength(5)]))
    .prop('locality', S.anyOf([S.null(), S.string().maxLength(100)]))
    .prop('sex', S.anyOf([S.null(), S.string().enum(['m', 'f', 'u'])]))
    .prop(
      'data',
      S.array().items(
        S.object()
          .prop('status', S.anyOf([S.null(), S.string().enum(['p', 'c', 'u'])]))
          .prop(
            'date',
            S.anyOf([
              S.null(),
              S.string()
                .minLength(10)
                .maxLength(10)
            ])
          )
          .prop(
            'fever',
            S.anyOf([
              S.null(),
              S.number()
                .minimum(0)
                .maximum(1)
            ])
          )
          .prop(
            'cough',
            S.anyOf([
              S.null(),
              S.number()
                .minimum(0)
                .maximum(1)
            ])
          )
          .prop(
            'breath',
            S.anyOf([
              S.null(),
              S.number()
                .minimum(0)
                .maximum(1)
            ])
          )
          .prop(
            'flu',
            S.anyOf([
              S.null(),
              S.number()
                .minimum(0)
                .maximum(1)
            ])
          )
      )
    ),
  response: {
    204: S.null()
  }
}

module.exports = { checkIn }
