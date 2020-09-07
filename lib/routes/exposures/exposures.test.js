const crypto = require('crypto')
const getConfig = require('../../../lib/config')
const faker = require('faker')
const jwt = require('jsonwebtoken')

describe('exposure routes', () => {
  let server, options

  beforeAll(async () => {
    options = await getConfig()

    server = require('fastify')()
    server.register(require('.'), options)
    server.register(require('../../plugins/jwt'), options)
    server.register(require('../../plugins/pg'), options)
    server.register(require('../../plugins/verify'), options)

    await server.ready()
  })

  beforeEach(() => {
    jest.setTimeout(10e4)
    jest.resetAllMocks()
  })

  afterAll(() => server.close())

  it('should list all exposure files', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )
    const results = [{ id: 1, path: 'test.txt' }]
    const mockSelect = jest.fn()

    mockSelect.mockResolvedValueOnce({ rowCount: 1, rows: results })
    mockSelect.mockResolvedValueOnce({ rowCount: 0, rows: [] })

    server.pg.read.query = mockSelect

    const response = await server.inject({
      method: 'GET',
      url: '/exposures?since=0',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    const payload = JSON.parse(response.payload)

    expect(mockSelect).toHaveBeenCalledTimes(2)
    expect(response.statusCode).toEqual(200)
    expect(payload).toEqual(results)
  })

  it('should verify an upload code', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )
    const result = faker.random.uuid()
    const mockQuery = jest.fn()

    mockQuery.mockResolvedValueOnce({ rowCount: 1 })
    mockQuery.mockResolvedValueOnce({ rows: [{ lastAttempt: null }] })
    mockQuery.mockResolvedValueOnce({
      rows: [
        { createdAt: new Date(), onsetDate: new Date(), testType: 'confirmed' }
      ]
    })
    mockQuery.mockResolvedValueOnce({ rows: [{ id: result }] })

    server.pg.write.query = mockQuery

    const response = await server.inject({
      method: 'POST',
      url: '/exposures/verify',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        hash: faker.random.alphaNumeric(256)
      }
    })

    const payload = JSON.parse(response.payload)

    expect(mockQuery).toHaveBeenCalledTimes(4)
    expect(response.statusCode).toEqual(200)
    expect(payload).toEqual({ token: result })
  })

  it('should fail when user is currently rate limited', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )
    const mockQuery = jest.fn()

    mockQuery.mockResolvedValueOnce({ rowCount: 0 })

    server.pg.write.query = mockQuery

    const response = await server.inject({
      method: 'POST',
      url: '/exposures/verify',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        hash: faker.random.alphaNumeric(256)
      }
    })

    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(429)
  })

  it('should fail when control code is currently rate limited', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )
    const mockQuery = jest.fn()

    mockQuery.mockResolvedValueOnce({ rowCount: 1 })
    mockQuery.mockResolvedValueOnce({ rows: [{ lastAttempt: new Date() }] })

    server.pg.write.query = mockQuery

    const response = await server.inject({
      method: 'POST',
      url: '/exposures/verify',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        hash: faker.random.alphaNumeric(256)
      }
    })

    expect(mockQuery).toHaveBeenCalledTimes(2)
    expect(response.statusCode).toEqual(429)
  })

  it('should fail when an invalid control is provided', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )
    const mockQuery = jest.fn()

    mockQuery.mockResolvedValueOnce({ rowCount: 1 })
    mockQuery.mockResolvedValueOnce({ rows: [] })

    server.pg.write.query = mockQuery

    const response = await server.inject({
      method: 'POST',
      url: '/exposures/verify',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        hash: faker.random.alphaNumeric(256)
      }
    })

    expect(mockQuery).toHaveBeenCalledTimes(2)
    expect(response.statusCode).toEqual(403)
  })

  it('should fail when an invalid hash is provided', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )
    const mockQuery = jest.fn()

    mockQuery.mockResolvedValueOnce({ rowCount: 1 })
    mockQuery.mockResolvedValueOnce({ rows: [{ lastAttempt: null }] })
    mockQuery.mockResolvedValueOnce({ rows: [] })

    server.pg.write.query = mockQuery

    const response = await server.inject({
      method: 'POST',
      url: '/exposures/verify',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        hash: faker.random.alphaNumeric(256)
      }
    })

    expect(mockQuery).toHaveBeenCalledTimes(3)
    expect(response.statusCode).toEqual(403)
  })

  it('should fail when an expired hash is provided', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )
    const mockQuery = jest.fn()
    const oldDate = new Date()

    oldDate.setDate(oldDate.getDate() - 1)

    mockQuery.mockResolvedValueOnce({ rowCount: 1 })
    mockQuery.mockResolvedValueOnce({ rows: [{ lastAttempt: null }] })
    mockQuery.mockResolvedValueOnce({
      rows: [{ createdAt: oldDate, onsetDate: oldDate }]
    })

    server.pg.write.query = mockQuery

    const response = await server.inject({
      method: 'POST',
      url: '/exposures/verify',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        hash: faker.random.alphaNumeric(256)
      }
    })

    expect(mockQuery).toHaveBeenCalledTimes(3)
    expect(response.statusCode).toEqual(410)
  })

  it('should upload exposures', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )
    const rollingStartNumber = Math.ceil(new Date().getTime() / 1000 / 600)
    const mockRead = jest.fn()
    const mockWrite = jest.fn()

    mockRead.mockResolvedValueOnce({ rowCount: 1 })
    mockWrite.mockResolvedValueOnce({ rows: [{ onsetDate: new Date() }] })
    mockWrite.mockResolvedValueOnce({})

    server.pg.read.query = mockRead
    server.pg.write.query = mockWrite

    const response = await server.inject({
      method: 'POST',
      url: '/exposures',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        token: faker.random.uuid(),
        platform: 'test',
        deviceVerificationPayload: token,
        exposures: [
          {
            keyData: crypto.randomBytes(16).toString('base64'),
            rollingStartNumber,
            transmissionRiskLevel: 0,
            rollingPeriod: 1
          },
          {
            keyData: crypto.randomBytes(16).toString('base64'),
            rollingStartNumber,
            transmissionRiskLevel: 8,
            rollingPeriod: 144
          }
        ]
      }
    })

    expect(mockRead).toHaveBeenCalledTimes(1)
    expect(mockWrite).toHaveBeenCalledTimes(3)
    expect(response.statusCode).toEqual(204)
  })

  it('should not fail when uploading an empty array', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )
    const mockRead = jest.fn()
    const mockWrite = jest.fn()

    mockRead.mockResolvedValueOnce({ rowCount: 1 })
    mockWrite.mockResolvedValueOnce({ rows: [{ onsetDate: new Date() }] })

    server.pg.read.query = mockRead
    server.pg.write.query = mockWrite

    const response = await server.inject({
      method: 'POST',
      url: '/exposures',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        token: faker.random.uuid(),
        platform: 'test',
        deviceVerificationPayload: token,
        exposures: []
      }
    })

    expect(mockRead).toHaveBeenCalledTimes(1)
    expect(mockWrite).toHaveBeenCalledTimes(2)
    expect(response.statusCode).toEqual(204)
  })

  it('should fail when using an invalid token', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )
    const mockRead = jest.fn()
    const mockWrite = jest.fn()

    mockRead.mockResolvedValueOnce({ rowCount: 1 })
    mockWrite.mockResolvedValueOnce({ rows: [] })

    server.pg.read.query = mockRead
    server.pg.write.query = mockWrite

    const response = await server.inject({
      method: 'POST',
      url: '/exposures',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        token: faker.random.uuid(),
        platform: 'test',
        deviceVerificationPayload: token,
        exposures: []
      }
    })

    expect(mockRead).toHaveBeenCalledTimes(1)
    expect(mockWrite).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(403)
  })
})
