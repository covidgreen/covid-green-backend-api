const { migrateSchema } = require('./migrate')
const Postgrator = require('postgrator')

jest.mock('postgrator')

describe('migrate', () => {
  it('performs migrations', async () => {
    const mockMigrate = jest.fn().mockResolvedValue([])
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {})
    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {})

    Postgrator.mockImplementation(() => ({ migrate: mockMigrate }))

    await migrateSchema()

    expect(mockMigrate).toHaveBeenCalledTimes(1)
    expect(mockLog).toHaveBeenCalledTimes(2)
    expect(mockExit).toHaveBeenCalledWith(0)
  })

  it('logs and exits on error', async () => {
    const mockMigrate = jest.fn().mockImplementation(async () => {
      throw new Error()
    })

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {})
    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {})

    Postgrator.mockImplementation(() => ({ migrate: mockMigrate }))

    await migrateSchema()

    expect(mockMigrate).toHaveBeenCalledTimes(1)
    expect(mockError).toHaveBeenCalledTimes(1)
    expect(mockExit).toHaveBeenCalledWith(1)
  })
})
