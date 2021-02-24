jest.mock('aws-sdk')

const getConfig = require('../../../lib/config')
const faker = require('faker')
const jwt = require('jsonwebtoken')
const { SQS } = require('aws-sdk')

const { free, selectByNonce, makeAvailable } = require('./query')

const mockSendPromise = jest.fn()
const mockSend = jest.fn()

SQS.mockImplementation(() => ({
  sendMessage: mockSend
}))

describe('notices routes', () => {
  let server, options

  beforeAll(async () => {
    options = await getConfig()
    options.security.noticesRateLimitSeconds = 0.1

    server = require('fastify')()
    server.register(require('../../plugins/jwt'), options)
    server.register(require('../../plugins/pg'), options)
    server.register(require('../../plugins/verify'), options)
    server.register(require('.'), options)

    await server.ready()
  })

  beforeEach(() => {
    jest.resetAllMocks()
    mockSendPromise.mockResolvedValue({})
    mockSend.mockReturnValue({ promise: mockSendPromise })
  })

  afterAll(() => server.close())

  it('should create new notice and return nonce', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )

    const mockQuery = jest.fn().mockResolvedValue({ rowCount: 1 })

    server.pg.write.query = mockQuery

    const response = await server.inject({
      method: 'POST',
      url: '/notices/create',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    const payload = JSON.parse(response.payload)

    expect(mockQuery).toHaveBeenCalledTimes(2)
    expect(response.statusCode).toEqual(200)
    expect(payload).toHaveProperty('nonce')
  })

  it('should verify nonce', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )
    const registerToken = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )

    const nonce = faker.random.words()
    const key = faker.random.uuid()
    const results = [{ id: key }]
    const selfIsolationEndDate = '2020-10-30'

    const mockSelect = jest.fn()
    mockSelect.mockResolvedValueOnce({ rowCount: 1, rows: results })
    mockSelect.mockResolvedValueOnce({ rowCount: 1 }) // from request.verify

    const mockQuery = jest.fn()
    mockQuery.mockResolvedValue({})

    server.pg.read.query = mockSelect
    server.pg.write.query = mockQuery

    const response = await server.inject({
      method: 'PUT',
      url: '/notices/create',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        nonce,
        platform: 'test',
        deviceVerificationPayload: registerToken,
        selfIsolationEndDate: selfIsolationEndDate
      }
    })

    const payload = JSON.parse(response.payload)

    expect(mockSelect).toHaveBeenCalledTimes(2)
    expect(mockSelect).toHaveBeenCalledWith(selectByNonce(nonce))

    expect(mockQuery).toHaveBeenCalledTimes(2)
    expect(mockQuery).toHaveBeenCalledWith(
      makeAvailable(key, selfIsolationEndDate)
    )
    expect(response.statusCode).toEqual(200)
    expect(payload).toEqual({ key })
  })

  it('should fail with an expired nonce', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )
    const registerToken = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )

    const nonce = faker.random.words()
    const selfIsolationEndDate = '2020-10-30'

    const mockSelect = jest.fn()
    mockSelect.mockResolvedValueOnce({ rowCount: 0, rows: [] })
    mockSelect.mockResolvedValueOnce({ rowCount: 1 }) // from request.verify

    const mockQuery = jest.fn()
    mockQuery.mockResolvedValue({})

    server.pg.read.query = mockSelect
    server.pg.write.query = mockQuery

    const response = await server.inject({
      method: 'PUT',
      url: '/notices/create',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        nonce,
        platform: 'test',
        deviceVerificationPayload: registerToken,
        selfIsolationEndDate
      }
    })

    expect(mockSelect).toHaveBeenCalledTimes(1)
    expect(mockSelect).toHaveBeenCalledWith(selectByNonce(nonce))

    expect(mockQuery).toHaveBeenCalledTimes(0)
    expect(response.statusCode).toEqual(404)
  })

  it('should validate key', async () => {
    const mockQuery = jest.fn()
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ count: 1 }] })
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ count: 0 }] })

    server.pg.read.query = mockQuery

    const makeCall = (key) =>
      server.inject({
        method: 'POST',
        url: '/notices/validate',
        body: { key }
      })

    const call1 = await makeCall(faker.random.uuid())
    const call2 = await makeCall(faker.random.uuid())

    expect(JSON.parse(call1.body)).toEqual({ valid: true })
    expect(JSON.parse(call2.body)).toEqual({ valid: false })
    expect(mockQuery).toHaveBeenCalledTimes(2)
  })

  describe('send', () => {
    it('should queue email', async () => {
      const selfIsolationEndDate = new Date()

      const mockQuery = jest.fn()
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ endDate: selfIsolationEndDate }]
      })
      mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{}] })

      server.pg.write.query = mockQuery

      const params = {
        key: faker.random.uuid(),
        senderEmail: faker.internet.email(),
        senderFullName: faker.random.words(),
        recipients: [faker.internet.email()],
        sendToAdmin: true
      }
      const response = await server.inject({
        method: 'POST',
        url: '/notices/send',
        body: params
      })

      expect(response.statusCode).toEqual(204)
      expect(mockQuery).toHaveBeenCalledTimes(3)
      expect(mockSend).toHaveBeenCalledTimes(1)
      expect(mockSend).toHaveBeenCalledWith({
        QueueUrl: options.aws.noticesQueueUrl,
        MessageBody: JSON.stringify({
          ...params,
          date: selfIsolationEndDate
        })
      })
    })

    it('should require valid key', async () => {
      const mockQuery = jest.fn()
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })

      server.pg.write.query = mockQuery

      const response = await server.inject({
        method: 'POST',
        url: '/notices/send',
        body: {
          key: faker.random.uuid(),
          senderEmail: faker.internet.email(),
          senderFullName: faker.random.words(),
          recipients: [faker.internet.email()]
        }
      })

      expect(response.statusCode).toEqual(400)
      expect(mockQuery).toHaveBeenCalledTimes(1)
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('should free key if send email fails', async () => {
      const mockQuery = jest.fn()
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ endDate: new Date() }]
      })
      mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{}] })

      mockSendPromise.mockRejectedValue(new Error())

      server.pg.write.query = mockQuery

      const key = faker.random.uuid()
      const response = await server.inject({
        method: 'POST',
        url: '/notices/send',
        body: {
          key,
          senderEmail: faker.internet.email(),
          senderFullName: faker.random.words(),
          recipients: [faker.internet.email()],
          sendToAdmin: true
        }
      })

      expect(response.statusCode).toEqual(500)
      expect(mockQuery).toHaveBeenCalledTimes(2)
      expect(mockQuery).toHaveBeenCalledWith(free(key))
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should require senderEmail', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/notices/send',
        body: {
          key: faker.random.uuid(),
          senderFullName: faker.random.words(),
          recipients: [faker.internet.email()]
        }
      })

      expect(response.statusCode).toEqual(400)
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('should require senderFullName', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/notices/send',
        body: {
          key: faker.random.uuid(),
          senderEmail: faker.internet.email(),
          recipients: [faker.internet.email()]
        }
      })

      expect(response.statusCode).toEqual(400)
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('should require at least a recipient', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/notices/send',
        body: {
          key: faker.random.uuid(),
          senderEmail: faker.internet.email(),
          senderFullName: faker.random.words(),
          recipients: []
        }
      })

      expect(response.statusCode).toEqual(400)
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('should require at most 40 recipients', async () => {
      const recipients = []
      while (recipients.length < 41) {
        recipients.push(faker.internet.email())
      }

      const response = await server.inject({
        method: 'POST',
        url: '/notices/send',
        body: {
          key: faker.random.uuid(),
          senderEmail: faker.internet.email(),
          senderFullName: faker.random.words(),
          recipients
        }
      })

      expect(response.statusCode).toEqual(400)
      expect(mockSend).not.toHaveBeenCalled()
    })
  })
})
