const getConfig = require('../../../lib/config')
const faker = require('faker')
const jwt = require('jsonwebtoken')

describe('check-in routes', () => {
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

  it('should insert check-in data', async () => {
    const mockInsert = jest.fn().mockResolvedValue({ rowCount: 1 })

    server.pg.write.query = mockInsert

    const response = await server.inject({
      method: 'POST',
      url: '/check-in',
      headers: {
        Authorization: `Bearer ${jwt.sign(
          { id: faker.lorem.word() },
          options.security.jwtSecret
        )}`
      },
      body: {
        ageRange: '21-30',
        locality: 'Dublin',
        sex: 'm',
        ok: true,
        data: [
          {
            location: [1, 2],
            status: 'u',
            date: '20/04/2020',
            fever: 0,
            cough: 1,
            breath: 0,
            flu: 0
          }
        ]
      }
    })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(204)
  })

  it('should fail when already checked in today', async () => {
    const mockInsert = jest.fn().mockResolvedValue({ rowCount: 0 })

    server.pg.write.query = mockInsert

    const response = await server.inject({
      method: 'POST',
      url: '/check-in',
      headers: {
        Authorization: `Bearer ${jwt.sign(
          { id: faker.lorem.word() },
          options.security.jwtSecret
        )}`
      },
      body: {
        ageRange: '21-30',
        locality: 'Dublin',
        sex: 'm',
        ok: true,
        data: [
          {
            location: [1, 2],
            status: 'u',
            date: '20/04/2020',
            fever: 0,
            cough: 1,
            breath: 0,
            flu: 0
          }
        ]
      }
    })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(429)
  })
})
