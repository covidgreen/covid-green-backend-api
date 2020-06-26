const faker = require('faker')

describe('pg plugin', () => {
  let server

  const query = 'SELECT table_schema, table_name FROM information_schema.tables'
  const client = {
    query: jest.fn().mockResolvedValue({})
  }
  const options = {
    pgPlugin: {
      read: '',
      write: '',
      config: {}
    }
  }

  beforeAll(async () => {
    server = require('fastify')()
    server.register(require('.'), options)

    // route that will make DB query
    server.route({
      method: 'GET',
      url: '/query',
      handler: async () => {
        const fakeClient = await server.pg.connect()
        return fakeClient.query(query)
      }
    })

    await server.ready()
    server.pg.connect = jest.fn()
  })

  beforeEach(() => {
    jest.setTimeout(10e4)
    jest.resetAllMocks()
  })

  afterAll(() => server.close())

  it('should instrument request with fastify-postgres', async () => {
    const result = faker.lorem.word()

    client.query.mockResolvedValue(result)
    server.pg.connect.mockResolvedValue(client)

    const response = await server.inject({
      method: 'GET',
      url: '/query'
    })

    expect(response.statusCode).toEqual(200)
    expect(response.payload).toEqual(result)
    expect(client.query).toHaveBeenNthCalledWith(1, query)
  })
})
