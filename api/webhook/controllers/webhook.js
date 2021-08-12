'use strict'
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const unparsed = require('koa-body/unparsed.js')

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

module.exports = {
  async index(ctx) {
    const { body } = ctx.request

    // Check if webhook signing is configured.
    if (webhookSecret) {
      // Retrieve the event by verifying the signature using the raw body and secret.
      let event
      const signature = ctx.request.header['stripe-signature']

      try {
        event = stripe.webhooks.constructEvent(body[unparsed], signature, webhookSecret)
      } catch (err) {
        ctx.response.status = 400
        const error = new Error('[Webhook Error] Webhook signature verification failed.')
        console.error(error)
        return { error }
      }
      // Extract the object from the event.
      const data = event.data.object
      const eventType = event.type

      ctx.response.status = 200

      let user
      let subscription
      let product
      let plan
      switch (eventType) {
        case 'invoice.paid':
          // grant customer access
          user = (
            await strapi.plugins['users-permissions'].services.user.fetchAll({
              stripeCustomerId: data.customer,
            })
          )[0]

          // get subscription from the customer
          subscription = await stripe.subscriptions.retrieve(data.subscription)

          // get associated product to the subscription
          product = subscription.items.data[0]?.price.product

          if (product) {
            plan = (
              await strapi.services.subscription.find({
                stripeProductId: product,
              })
            )[0]
          }

          if (user && subscription && plan) {
            // set dates
            user.subscriptionStart = new Date(subscription.start_date * 1000)
            user.subscriptionEnd = new Date(subscription.current_period_end * 1000)
            user.subscriptionActive = true
            user.subscription = plan

            // do not update password
            delete user.password
            // update user
            await strapi.plugins['users-permissions'].services.user.edit({ id: user.id }, user)
          } else {
            if (!user) {
              console.error(
                `[Webhook Error](${eventType}) User not found with Stripe customer id: ${data.customer}`
              )
            }
            if (!subscription) {
              console.error(
                `[Webhook Error](${eventType}) Stripe subscription not found with: ${data.subscription}`
              )
            }
            if (!plan) {
              console.error(`[Webhook Error](${eventType}) Subscription not found with: ${product}`)
            }
          }
          break

        case 'customer.subscription.deleted':
        // revoke subscription access if a subscription has been immediately terminated
        case 'invoice.payment_failed':
          // revoke subscription access
          user = (
            await strapi.plugins['users-permissions'].services.user.fetchAll({
              stripeCustomerId: data.customer,
            })
          )[0]

          if (user) {
            // disabled subscription
            user.subscriptionActive = false

            // do not update password
            delete user.password
            // update user
            await strapi.plugins['users-permissions'].services.user.edit({ id: user.id }, user)
          } else {
            console.error(
              `[Webhook Error](${eventType}) User not found with Stripe customer id: ${data.customer}`
            )
          }
          break
        default:
          ctx.response.status = 400
          const error = new Error(`[Webhook Error] Unhandled type ${eventType}`)
          console.error(error)
          return { error }
      }
    } else {
      ctx.response.status = 400
      const error = new Error('[Webhook Error] Webhook signature required')
      console.error(error)
      return { error }
    }
  },
}
