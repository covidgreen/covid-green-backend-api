jest.mock('aws-sdk')

const getConfig = require('../../../lib/config')
const faker = require('faker')
const jwt = require('jsonwebtoken')

const { registerRateLimitedNotice } = require('./query')

describe('notices routes', () => {
  let server, options

  beforeAll(async () => {
    options = await getConfig()
    options.security.noticesRateLimitSeconds = 5

    server = require('fastify')()
    server.register(require('.'), options)
    server.register(require('../../plugins/jwt'), options)
    server.register(require('../../plugins/pg'), options)

    await server.ready()
  })

  beforeEach(() => {
    jest.setTimeout(10e4)
    jest.resetAllMocks()
  })

  afterAll(() => server.close())

  it('should create nonce and return', async () => {
    const mockQuery = jest.fn().mockResolvedValueOnce({ rowCount: 1 })

    server.pg.write.query = mockQuery

    const id = faker.lorem.word()
    const response = await server.inject({
      method: 'POST',
      url: '/notices/create',
      headers: {
        Authorization: `Bearer ${jwt.sign({ id }, options.security.jwtSecret)}`
      }
    })

    const payload = JSON.parse(response.payload)

    expect(mockQuery).toHaveBeenCalledTimes(2)
    expect(mockQuery).toHaveBeenCalledWith(
      registerRateLimitedNotice({
        registrationId: id,
        rateLimitSeconds: 5,
        rateLimitRequestCount: 2
      })
    )
    expect(response.statusCode).toEqual(200)
    expect(payload).toHaveProperty('nonce')
  })

  it('should fail when already requested callback within rate limit', async () => {
    const mockQuery = jest
      .fn()
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 1 })

    server.pg.write.query = mockQuery

    const response = await server.inject({
      method: 'POST',
      url: '/notices/create',
      headers: {
        Authorization: `Bearer ${jwt.sign(
          { id: faker.lorem.word() },
          options.security.jwtSecret
        )}`
      }
    })

    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(429)
  })
})
