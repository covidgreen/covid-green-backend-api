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

    const mockInsert = jest.fn()
    const mockSelect = jest.fn()

    mockSelect.mockResolvedValueOnce({ rowCount: 1, rows: results })
    mockSelect.mockResolvedValueOnce({ rowCount: 0, rows: [] })
    mockInsert.mockResolvedValueOnce({ rowCount: 1 })

    server.pg.read.query = mockSelect
    server.pg.write.query = mockInsert

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
    const result = faker.datatype.uuid()
    const mockWrite = jest.fn()
    const mockRead = jest.fn()

    mockWrite.mockResolvedValueOnce({ rowCount: 1 })
    mockRead.mockResolvedValueOnce({
      rows: [
        {
          verificationId: 1,
          createdAt: new Date(),
          onsetDate: new Date(),
          testType: 'confirmed'
        }
      ]
    })
    mockWrite.mockResolvedValueOnce({})
    mockWrite.mockResolvedValueOnce({ rows: [{ id: result }] })

    server.pg.read.query = mockRead
    server.pg.write.query = mockWrite

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

    expect(mockWrite).toHaveBeenCalledTimes(7)
    expect(mockRead).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(200)
    expect(payload.token).toEqual(result)
  })

  it('should handle chaff request to verify', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )
    const mockWrite = jest.fn()
    const mockRead = jest.fn()

    server.pg.read.query = mockRead
    server.pg.write.query = mockWrite

    const response = await server.inject({
      method: 'POST',
      url: '/verify',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Chaff': '1'
      },
      body: {
        code: faker.datatype.number(6),
        padding: faker.random.alphaNumeric(20)
      }
    })

    const payload = JSON.parse(response.payload)

    expect(mockWrite).toHaveBeenCalledTimes(1)
    expect(mockRead).toHaveBeenCalledTimes(0)
    expect(response.statusCode).toEqual(200)
    expect(payload).toHaveProperty('padding')
  })

  it('should handle chaff request to certificate', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )
    const mockWrite = jest.fn()
    const mockRead = jest.fn()

    server.pg.read.query = mockRead
    server.pg.write.query = mockWrite

    const response = await server.inject({
      method: 'POST',
      url: '/certificate',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Chaff': '1'
      },
      body: {
        token: faker.random.alphaNumeric(50),
        ekeyhmac: faker.random.alphaNumeric(44)
      }
    })

    const payload = JSON.parse(response.payload)

    expect(mockWrite).toHaveBeenCalledTimes(1)
    expect(mockRead).toHaveBeenCalledTimes(0)
    expect(response.statusCode).toEqual(200)
    expect(payload).toHaveProperty('padding')
  })

  it('should handle chaff request to exposures/verify', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )
    const mockWrite = jest.fn()
    const mockRead = jest.fn()

    server.pg.read.query = mockRead
    server.pg.write.query = mockWrite

    const response = await server.inject({
      method: 'POST',
      url: '/exposures/verify',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Chaff': '1'
      },
      body: {
        hash: faker.random.alphaNumeric(256)
      }
    })

    const payload = JSON.parse(response.payload)
    expect(mockWrite).toHaveBeenCalledTimes(1)
    expect(mockRead).toHaveBeenCalledTimes(0)
    expect(response.statusCode).toEqual(200)
    expect(payload).toHaveProperty('padding')
  })

  it('should handle chaff request to publish', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )
    const mockWrite = jest.fn()
    const mockRead = jest.fn()
    const rollingStartNumber = Math.floor(new Date().getTime() / 1000 / 600)

    server.pg.read.query = mockRead
    server.pg.write.query = mockWrite

    const response = await server.inject({
      method: 'POST',
      url: '/publish',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Chaff': '1'
      },
      body: {
        token: faker.datatype.uuid(),
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

    const payload = JSON.parse(response.payload)
    expect(mockWrite).toHaveBeenCalledTimes(1)
    expect(mockRead).toHaveBeenCalledTimes(0)
    expect(response.statusCode).toEqual(200)
    expect(payload).toHaveProperty('padding')
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

  it('should fail when an invalid control is provided', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )

    const mockRead = jest.fn()
    const mockWrite = jest.fn()

    mockWrite.mockResolvedValueOnce({ rowCount: 1 })
    mockRead.mockResolvedValueOnce({ rows: [] })

    server.pg.write.query = mockWrite
    server.pg.read.query = mockRead

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

    expect(mockWrite).toHaveBeenCalledTimes(2)
    expect(mockRead).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(403)
  })

  it('should fail when an invalid hash is provided', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )

    const mockRead = jest.fn()
    const mockWrite = jest.fn()

    mockWrite.mockResolvedValueOnce({ rowCount: 1 })
    mockRead.mockResolvedValueOnce({ rows: [] })

    server.pg.read.query = mockRead
    server.pg.write.query = mockWrite

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

    expect(mockWrite).toHaveBeenCalledTimes(2)
    expect(mockRead).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(403)
  })

  it('should fail when an expired hash is provided', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )

    const mockRead = jest.fn()
    const mockWrite = jest.fn()
    const oldDate = new Date()

    oldDate.setDate(oldDate.getDate() - 1)

    mockWrite.mockResolvedValueOnce({ rowCount: 1 })
    mockRead.mockResolvedValueOnce({
      rows: [{ verificationId: 1, onsetDate: oldDate, lastUpdatedAt: oldDate }]
    })

    server.pg.read.query = mockRead
    server.pg.write.query = mockWrite

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

    expect(mockWrite).toHaveBeenCalledTimes(2)
    expect(mockRead).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(410)
  })

  it('should upload exposures', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )
    const rollingStartNumber = Math.floor(new Date().getTime() / 1000 / 600)
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
        token: faker.datatype.uuid(),
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
        token: faker.datatype.uuid(),
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
        token: faker.datatype.uuid(),
        platform: 'test',
        deviceVerificationPayload: token,
        exposures: []
      }
    })

    expect(mockRead).toHaveBeenCalledTimes(1)
    expect(mockWrite).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(403)
  })

  it('should redirect to android intent if android device', async () => {
    const code = '14321456789'
    const region = 'IE'
    const appPackage = 'com.nf.app'
    const playstoreLink = encodeURIComponent(
      `https://play.google.com/store/apps/details?id=${appPackage}`
    )
    const redirect = `intent://v?c=${code}&r=${region}#Intent;scheme=ens;package=${appPackage};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${playstoreLink};end`
    const response = await server.inject({
      method: 'GET',
      url: `/v?c=${code}`,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 6.0.1; RedMi Note 5 Build/RB3N5C; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/68.0.3440.91 Mobile Safari/537.36'
      }
    })

    expect(response.statusCode).toEqual(303)
    expect(response.headers.location).toEqual(redirect)
  })

  it('should redirect to appstore if ios device', async () => {
    const code = '14321456789'
    const appstoreLink =
      'https://apps.apple.com/ie/app/covid-tracker-nf/id1234567'
    const response = await server.inject({
      method: 'GET',
      url: `/v?c=${code}`,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1'
      }
    })
    expect(response.statusCode).toEqual(301)
    expect(response.headers.location).toEqual(appstoreLink)
  })

  it('should redirect to web page if not ios or android device', async () => {
    const code = '14321456789'
    const pageLink = 'https://nf.com/covidapps'
    const response = await server.inject({
      method: 'GET',
      url: `/v?c=${code}`,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.1.2 Safari/605.1.15'
      }
    })
    expect(response.statusCode).toEqual(301)
    expect(response.headers.location).toEqual(pageLink)
  })

  it.skip('should return 404 if deeplinks not supported', async () => {
    const code = '14321456789'
    const response = await server.inject({
      method: 'GET',
      url: `/v?c=${code}`,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.1.2 Safari/605.1.15'
      }
    })
    expect(response.statusCode).toEqual(404)
  })
})
