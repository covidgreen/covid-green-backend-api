const getConfig = require('./config')

describe('server', () => {
  it('starts a server and register plugins', async () => {
    const server = { register: jest.fn(), addHook: jest.fn() }
    server.register.mockReturnValue(server)
    require('./server')(server, await getConfig())
    expect(server.register).toHaveBeenCalledTimes(5)
  })
})
