const { build, fake } = require('test-data-bot')
const faker = require('faker/locale/fr')

const userBuilder = build('User')
  .fields({
    email: fake(() => faker.internet.email()),
    provider: 'local',
    password: fake(() => faker.internet.password()),
    confirmed: true,
    blocked: null,
    realname: fake(() => faker.name.firstName()),
    stripeCustomerId: null,
    subscriptionStart: null,
    subscriptionEnd: null,
    subscriptionActive: null,
    subscription: null,
  })
  .map((user) => ({
    ...user,
    username: user.email.toLowerCase(),
    email: user.email.toLowerCase(),
  }))

module.exports = async (overrides = {}, options = { save: true }) => {
  const user = userBuilder(overrides)

  // set default authenticated role to user
  const authenticatedRole = await strapi.plugins[
    'users-permissions'
  ].services.userspermissions.getRole(1, [])
  user.role = authenticatedRole

  if (options.save) {
    return await strapi.plugins['users-permissions'].services.user.add(user)
  }
  return Promise.resolve(user)
}

module.exports.builder = userBuilder
