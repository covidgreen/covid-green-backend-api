const getConfig = require('./config')

describe('server', () => {
  it('starts a mock server and register plugins', async () => {
    const server = {
      register: jest.fn(),
      addHook: jest.fn(),
      setErrorHandler: jest.fn()
    }

    server.register.mockReturnValue(server)
    require('./server')(server, await getConfig())
    expect(server.register).toHaveBeenCalledTimes(5)
  })

  it('starts a real server and hits an authenticated route successfully', async () => {
    const fastify = require('fastify')()

    await fastify.register(require('./server'), await getConfig())

    const response = await fastify.inject('/settings/exposures')

    expect(response.statusCode).toBe(401)
  })
})
