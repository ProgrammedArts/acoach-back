'use strict'

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  // this is only to use in graphql resolvers
  async isAuthenticated(ctx) {
    return !!ctx.state.user
  },
}
