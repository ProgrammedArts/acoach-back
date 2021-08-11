const fs = require('fs')
const { setupStrapi } = require('./helpers/strapi')
const setupServer = require('./helpers/serverSetup')

jest.setTimeout(15000)

/** this code is called once before any test is called */
beforeAll(async () => {
  await setupStrapi() // singleton so it can be called many times
  await setupServer()
})

/** this code is called once before all the tested are finished */
afterAll(async () => {
  const dbSettings = strapi.config.get('database.connections.default.settings')

  //close server to release the db-file
  await strapi.destroy()

  //delete test database after all tests
  if (dbSettings && dbSettings.filename) {
    const tmpDbFile = `${__dirname}/../${dbSettings.filename}`
    if (fs.existsSync(tmpDbFile)) {
      fs.unlinkSync(tmpDbFile)
    }
  }
})

// ensure that stripe does not work
process.env.STRIPE_SECRET_KEY = ''

it('strapi is defined', () => {
  expect(strapi).toBeDefined()
})

// require('./user')
// require('./stripe')
// require('./subscription')
// require('./webhook')
require('./workoutVideos')
