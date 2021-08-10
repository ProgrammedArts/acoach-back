'use strict'
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

module.exports = {
  definition: `
    extend type Subscription {
      price: Int
      currency: String
    }
  `,
  query: ``,
  mutation: ``,
  type: {},
  resolver: {
    Query: {
      subscriptions: {
        description: 'Get subscriptions',
        resolverOf: 'application::subscription.subscription.find',
        resolver: async (_, query) => {
          const subscriptions = await strapi.controllers.subscription.find(query)

          // add price to results
          for (let i = 0; i < subscriptions.length; i++) {
            const subscription = subscriptions[i]

            const [price] = (
              await stripe.prices.list({
                product: subscription.stripeProductId,
              })
            ).data

            if (price) {
              subscription.price = price.unit_amount
              subscription.currency = price.currency
            }
          }

          return subscriptions
        },
      },
    },
    Mutation: {},
  },
}
