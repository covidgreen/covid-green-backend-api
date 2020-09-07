const getConfig = require('../../../lib/config')
const crypto = require('crypto')
const faker = require('faker')
const jwt = require('jsonwebtoken')

const encrypt = (key, value) => {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv)
  const buffer = cipher.update(value.toString())
  const encrypted = Buffer.concat([buffer, cipher.final()])

  return `${iv.toString('hex')}${encrypted.toString('hex')}`
}

describe('register routes', () => {
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

  it('should return a nonce', async () => {
    const mockInsert = jest.fn().mockResolvedValue({})

    server.pg.write.query = mockInsert

    const response = await server.inject({
      method: 'POST',
      url: '/register'
    })

    const payload = JSON.parse(response.payload)

    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(200)
    expect(payload).toEqual(
      expect.objectContaining({
        nonce: expect.any(String)
      })
    )
  })

  it('should fail when providing an expired nonce', async () => {
    const registerToken = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )
    const mockSelect = jest.fn()

    mockSelect.mockResolvedValueOnce({ rowCount: 0 })

    server.pg.read.query = mockSelect

    const response = await server.inject({
      method: 'PUT',
      url: '/register',
      body: {
        nonce: faker.random.word(),
        platform: 'test',
        deviceVerificationPayload: registerToken
      }
    })

    expect(mockSelect).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(404)
  })

  it('should return a valid token and refresh token', async () => {
    const registerToken = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )
    const result = { id: faker.lorem.word() }
    const mockSelect = jest.fn()
    const mockUpdate = jest.fn().mockResolvedValue({ rows: [result] })

    mockSelect.mockResolvedValueOnce({ rowCount: 1, rows: [result] })
    mockSelect.mockResolvedValueOnce({ rowCount: 1 })

    server.pg.read.query = mockSelect
    server.pg.write.query = mockUpdate

    const response = await server.inject({
      method: 'PUT',
      url: '/register',
      body: {
        nonce: faker.random.word(),
        platform: 'test',
        deviceVerificationPayload: registerToken
      }
    })

    const payload = JSON.parse(response.payload)

    expect(mockSelect).toHaveBeenCalledTimes(2)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(200)
    expect(payload).toEqual({
      refreshToken: expect.any(String),
      token: expect.any(String)
    })

    const refreshToken = jwt.verify(
      payload.refreshToken,
      options.security.jwtSecret
    )
    const token = jwt.verify(payload.token, options.security.jwtSecret)

    expect(refreshToken).toEqual(expect.objectContaining(result))
    expect(token).toEqual(expect.objectContaining(result))
  })

  it('should return a valid token when a valid refresh token is provided', async () => {
    const token = {
      id: faker.lorem.word(),
      refresh: faker.lorem.word()
    }

    const mockSelect = jest.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ refresh: encrypt(options.security.encryptKey, token.refresh) }]
    })

    server.pg.read.query = mockSelect

    const response = await server.inject({
      method: 'POST',
      url: '/refresh',
      headers: {
        Authorization: `Bearer ${jwt.sign(token, options.security.jwtSecret)}`
      }
    })

    const payload = JSON.parse(response.payload)

    expect(response.statusCode).toEqual(200)
    expect(payload).toEqual({
      token: expect.any(String)
    })

    const responseToken = jwt.verify(payload.token, options.security.jwtSecret)

    expect(mockSelect).toHaveBeenCalledTimes(1)
    expect(responseToken).toEqual(expect.objectContaining({ id: token.id }))
  })

  it('should return an error when a refresh token is not provided', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/refresh'
    })

    expect(response.statusCode).toEqual(401)
  })

  it('should return an error when an auth token is provided instead of a refresh token', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/refresh',
      headers: {
        Authorization: `Bearer ${jwt.sign(
          { id: faker.lorem.word() },
          options.security.jwtSecret
        )}`
      }
    })

    expect(response.statusCode).toEqual(401)
  })

  it('should return an error if the user has been deleted', async () => {
    const token = {
      id: faker.lorem.word(),
      refresh: faker.lorem.word()
    }

    const mockSelect = jest.fn().mockResolvedValue({
      rowCount: 0,
      rows: []
    })

    server.pg.read.query = mockSelect

    const response = await server.inject({
      method: 'POST',
      url: '/refresh',
      headers: {
        Authorization: `Bearer ${jwt.sign(token, options.security.jwtSecret)}`
      }
    })

    expect(mockSelect).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(401)
  })

  it('should return an error if the refresh token has been invalidated', async () => {
    const token = {
      id: faker.lorem.word(),
      refresh: faker.lorem.word()
    }

    const mockSelect = jest.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ refresh: encrypt(options.security.encryptKey, 'incorrect') }]
    })

    server.pg.read.query = mockSelect

    const response = await server.inject({
      method: 'POST',
      url: '/refresh',
      headers: {
        Authorization: `Bearer ${jwt.sign(token, options.security.jwtSecret)}`
      }
    })

    expect(mockSelect).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(401)
  })

  it('should remove a user', async () => {
    const id = faker.lorem.word()

    const mockDelete = jest.fn().mockResolvedValue({
      rowCount: 1
    })

    server.pg.write.query = mockDelete

    const response = await server.inject({
      method: 'DELETE',
      url: '/register',
      headers: {
        Authorization: `Bearer ${jwt.sign({ id }, options.security.jwtSecret)}`
      }
    })

    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(204)
  })
})
