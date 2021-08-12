'use strict'
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const hasActiveSubscription = require('../../../helpers/hasActiveSubscription')

module.exports = {
  definition: `
    type CheckoutSession {
      url: String
    }

    type CustomerPortal {
      url: String
    }

    input CreateCheckoutInput {
      subscriptionId: ID!
    }
  `,
  query: `
    getCustomerPortal: CustomerPortal
  `,
  mutation: `
    createCheckout(input: CreateCheckoutInput): CheckoutSession
  `,
  type: {},
  resolver: {
    Query: {
      getCustomerPortal: {
        description: 'Gets the URL to the customer portal',
        resolverOf: 'application::subscription.subscription.create',
        resolver: async (_obj, _params, { context }) => {
          const { user } = context.state

          if (user?.stripeCustomerId) {
            const portalSession = await stripe.billingPortal.sessions.create({
              customer: user.stripeCustomerId,
              return_url: `${process.env.SITE_HOST}`,
            })

            return {
              url: portalSession.url,
            }
          }

          throw new Error(`User does not have a Stripe customer id ${user.id}`)
        },
      },
    },
    Mutation: {
      createCheckout: {
        description: 'Creates a checkout session',
        resolverOf: 'application::subscription.subscription.create',
        resolver: async (_, { input: { subscriptionId } }, { context }) => {
          const { user } = context.state

          const subscription = await strapi.services.subscription.findOne({
            id: subscriptionId,
          })

          if (subscription && user) {
            // create a stripe customer and update the user with it
            if (!user.stripeCustomerId) {
              const customer = await stripe.customers.create({
                email: user.email,
                name: user.realname,
                preferred_locales: ['fr-FR'],
              })

              // add stripe customer id
              user.stripeCustomerId = customer.id

              // do not update password
              delete user.password

              // update user
              await strapi.plugins['users-permissions'].services.user.edit({ id: user.id }, user)
            }

            if (hasActiveSubscription(user)) {
              throw new Error(`User ${user.email} already has an active subscription`)
            }

            const [price] = (
              await stripe.prices.list({
                product: subscription.stripeProductId,
              })
            ).data

            if (price) {
              const session = await stripe.checkout.sessions.create({
                mode: 'subscription',
                payment_method_types: ['card'],
                line_items: [
                  {
                    price: price.id,
                    // For metered billing, do not pass quantity
                    quantity: 1,
                  },
                ],
                success_url: `${process.env.SITE_HOST}/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.SITE_HOST}/canceled`,
                locale: 'fr',
                customer: user.stripeCustomerId,
              })

              return {
                url: session.url,
              }
            }
            throw new Error(`No Stripe product or price for ${subscription.stripeProductId}`)
          }

          throw new Error(`Subscription not found (${subscriptionId})`)
        },
      },
    },
  },
}
