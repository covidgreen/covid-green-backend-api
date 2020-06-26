const { version } = require('../../../package')

describe('health route', () => {
  let server

  beforeAll(async () => {
    server = require('fastify')()
    server.register(require('.'))
    await server.ready()
  })

  beforeEach(() => {
    jest.setTimeout(10e4)
    jest.resetAllMocks()
  })

  afterAll(async () => server.close())

  it('should return server health', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/healthcheck'
    })

    expect(response.statusCode).toEqual(200)
    expect(JSON.parse(response.payload)).toEqual(
      expect.objectContaining({
        db: 'ok',
        serverTimestamp: expect.any(String),
        status: 'ok',
        version
      })
    )
  })
})
