const { migrateSchema } = require('./migrate')
const Postgrator = require('postgrator')

jest.mock('postgrator')

describe('migrate', () => {
  it('performs migrations', async () => {
    const mockMigrate = jest.fn().mockResolvedValue([])
    const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {})

    Postgrator.mockImplementation(() => ({ migrate: mockMigrate }))

    await migrateSchema()

    expect(process.exitCode).toEqual(0)

    expect(mockMigrate).toHaveBeenCalledTimes(1)
    expect(mockLog).toHaveBeenCalledTimes(2)
  })

  it('logs and exits on error', async () => {
    const mockMigrate = jest.fn().mockImplementation(async () => {
      throw new Error()
    })

    const mockError = jest.spyOn(console, 'error').mockImplementation(() => {})

    Postgrator.mockImplementation(() => ({ migrate: mockMigrate }))

    await migrateSchema()

    expect(process.exitCode).toEqual(1)

    expect(mockMigrate).toHaveBeenCalledTimes(1)
    expect(mockError).toHaveBeenCalledTimes(1)
  })
})
