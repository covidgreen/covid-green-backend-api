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
        mobile: `+${faker.random.number({ min: 1000000, max: 100000000 })}`,
        closeContactDate: new Date().getTime()
      }
    })

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(204)
  })

  it('should fail when already requested callback', async () => {
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
        mobile: `+${faker.random.number({ min: 1000000, max: 100000000 })}`,
        closeContactDate: new Date().getTime()
      }
    })

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(429)
  })
})
