jest.mock('aws-sdk')

const getConfig = require('../../../lib/config')
const faker = require('faker')
const jwt = require('jsonwebtoken')
const { SQS } = require('aws-sdk')

const mockSend = jest.fn().mockResolvedValue({})

SQS.mockImplementation(() => ({
  sendMessage: () => ({
    promise: mockSend
  })
}))

describe('callback routes', () => {
  let server, options

  beforeAll(async () => {
    options = await getConfig()
    options.security.callbackRateLimitSeconds = 5
    options.security.callbackRateLimitRequestCount = 2

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

  it('should send message to sqs queue', async () => {
    const mockUpdate = jest.fn().mockResolvedValue({ rowCount: 1 })

    server.pg.write.query = mockUpdate

    const response = await server.inject({
      method: 'POST',
      url: '/callback',
      headers: {
        Authorization: `Bearer ${jwt.sign(
          { id: faker.lorem.word() },
          options.security.jwtSecret
        )}`
      },
      body: {
        mobile: `+${faker.datatype.number({
          min: 10000000000,
          max: 19999999999
        })}`,
        closeContactDate: new Date().getTime()
      }
    })

    expect(mockUpdate).toHaveBeenCalledTimes(2)
    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(204)
  })

  it('should fail when already requested callback within rate limit', async () => {
    const mockUpdate = jest.fn().mockResolvedValue({ rowCount: 0 })

    server.pg.write.query = mockUpdate

    const response = await server.inject({
      method: 'POST',
      url: '/callback',
      headers: {
        Authorization: `Bearer ${jwt.sign(
          { id: faker.lorem.word() },
          options.security.jwtSecret
        )}`
      },
      body: {
        mobile: `+${faker.datatype.number({
          min: 10000000000,
          max: 19999999999
        })}`,
        closeContactDate: new Date().getTime()
      }
    })

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(429)
  })

  it('should call database with rate limit check', async () => {
    const mockUpdate = jest.fn((query) => {
      if (
        query.text.includes(
          'WHEN last_callback IS NULL OR last_callback <= CURRENT_TIMESTAMP'
        )
      ) {
        return { rowCount: 1 }
      } else {
        return { rowCount: 0 }
      }
    })

    server.pg.write.query = mockUpdate

    const response = await server.inject({
      method: 'POST',
      url: '/callback',
      headers: {
        Authorization: `Bearer ${jwt.sign(
          { id: faker.lorem.word() },
          options.security.jwtSecret
        )}`
      },
      body: {
        mobile: `+${faker.datatype.number({
          min: 10000000000,
          max: 19999999999
        })}`,
        closeContactDate: new Date().getTime()
      }
    })

    expect(mockUpdate).toHaveBeenCalledTimes(2)
    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(204)
  })
})
