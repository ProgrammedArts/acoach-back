const { build, fake } = require('test-data-bot')
const faker = require('faker/locale/fr')

const subscriptionBuilder = build('Subscription').fields({
  name: fake(() => faker.name.findName()),
  stripeProductId: fake(() => `prod_${faker.random.alphaNumeric(15)}`),
  description: fake(() => faker.lorem.sentence()),
  fullAccess: false,
})

module.exports = async (overrides = {}, options = { save: true }) => {
  const subscription = subscriptionBuilder(overrides)

  if (options.save) {
    return await strapi.services.subscription.create(subscription)
  }
  return Promise.resolve(subscription)
}

module.exports.builder = subscriptionBuilder
