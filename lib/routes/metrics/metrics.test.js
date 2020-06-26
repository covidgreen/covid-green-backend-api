const getConfig = require('../../../lib/config')
const faker = require('faker')
const jwt = require('jsonwebtoken')

describe('metrics routes', () => {
  let server, options

  beforeAll(async () => {
    options = await getConfig()

    server = require('fastify')()
    server.register(require('.'), { ...options, metrics: { TEST: 1 } })
    server.register(require('../../plugins/jwt'), options)
    server.register(require('../../plugins/pg'), options)

    await server.ready()
  })

  beforeEach(() => {
    jest.setTimeout(10e4)
    jest.resetAllMocks()
  })

  afterAll(() => server.close())

  it('should insert metric data', async () => {
    const mockInsert = jest.fn()

    mockInsert.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ lastRequest: null }]
    })

    mockInsert.mockResolvedValueOnce({ rowCount: 1 })

    server.pg.write.query = mockInsert

    const response = await server.inject({
      method: 'POST',
      url: '/metrics',
      headers: {
        Authorization: `Bearer ${jwt.sign(
          { id: faker.lorem.word() },
          options.security.jwtSecret
        )}`
      },
      body: {
        event: 'TEST',
        os: faker.random.arrayElement(['android', 'ios']),
        version: '0.0.1-test'
      }
    })

    expect(mockInsert).toHaveBeenCalledTimes(2)
    expect(response.statusCode).toEqual(204)
  })

  it('should fail when rate limited', async () => {
    const mockInsert = jest.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ lastRequest: new Date() }]
    })

    server.pg.write.query = mockInsert

    const response = await server.inject({
      method: 'POST',
      url: '/metrics',
      headers: {
        Authorization: `Bearer ${jwt.sign(
          { id: faker.lorem.word() },
          options.security.jwtSecret
        )}`
      },
      body: {
        event: 'TEST',
        os: faker.random.arrayElement(['android', 'ios']),
        version: '0.0.1-test'
      }
    })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(429)
  })
})
