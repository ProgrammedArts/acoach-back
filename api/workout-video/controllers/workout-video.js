'use strict'
const { sanitizeEntity } = require('strapi-utils')
const hasActiveSubscription = require('../../../helpers/hasActiveSubscription')

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async find(ctx) {
    let entities = []

    if (ctx.state.user) {
      const user = await strapi.plugins['users-permissions'].services.user.fetch({
        id: ctx.state.user.id,
      })

      const query = {
        ...ctx.query,
      }
      if (hasActiveSubscription(user)) {
        if (!user.subscription.fullAccess) {
          query.subscription = user.subscription.id
        }
      } else {
        query.subscription_in = []
      }

      if (query._q) {
        entities = await strapi.services['workout-video'].search(query)
      } else {
        entities = await strapi.services['workout-video'].find(query)
      }
    }

    return entities.map((entity) =>
      sanitizeEntity(entity, { model: strapi.models['workout-video'] })
    )
  },

  async findOne(ctx) {
    const { id } = ctx.params

    if (ctx.state.user) {
      const user = await strapi.plugins['users-permissions'].services.user.fetch({
        id: ctx.state.user.id,
      })

      const query = {
        id,
      }
      if (hasActiveSubscription(user)) {
        if (!user.subscription.fullAccess) {
          query.subscription = user.subscription.id
        }
      } else {
        query.subscription_in = []
      }

      const [entity] = await strapi.services['workout-video'].find(query)
      return sanitizeEntity(entity, { model: strapi.models['workout-video'] })
    }
    return sanitizeEntity(undefined, { model: strapi.models['workout-video'] })
  },

  async count(ctx) {
    if (ctx.state.user) {
      const user = await strapi.plugins['users-permissions'].services.user.fetch({
        id: ctx.state.user.id,
      })

      const query = {
        ...ctx.query,
      }
      if (hasActiveSubscription(user)) {
        if (!user.subscription.fullAccess) {
          query.subscription = user.subscription.id
        }
      } else {
        query.subscription_in = []
      }

      if (query._q) {
        return strapi.services.restaurant.countSearch(query)
      }
      return strapi.services.restaurant.count(query)
    }

    return 0
  },
}
