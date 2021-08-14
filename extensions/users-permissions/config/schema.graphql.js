const _ = require('lodash')
const isStrongPassword = require('validator/lib/isStrongPassword')
const checkBadRequest = require('../../../helpers/checkBadRequest')
const throwGraphQLError = require('../../../helpers/throwGraphQLError')

module.exports = {
  definition: `
    input UsersPermissionsWithRealNameRegisterInput {
        username: String!
        realname: String!
        email: String!
        password: String!
    }

    extend type UsersPermissionsMe {
      realname: String!
    }

    input SendEmailConfirmationInput {
      email: String!
    }

    type SendEmailConfirmationResult {
      email: String!
      sent: Boolean!
    }
  `,
  query: ``,
  mutation: `
    registerWithRealName(input: UsersPermissionsWithRealNameRegisterInput!): UsersPermissionsLoginPayload!
    sendEmailConfirmation(input: SendEmailConfirmationInput!): SendEmailConfirmationResult!
  `,
  type: {},
  resolver: {
    Query: {},
    Mutation: {
      registerWithRealName: {
        description: 'Register a user',
        resolverOf: 'plugins::users-permissions.auth.register',
        resolver: async (_obj, options, { context }) => {
          context.request.body = _.toPlainObject(options.input)

          // validate password
          if (
            !isStrongPassword(options.input.password, {
              minLength: 8,
              minLowercase: 0,
              minUppercase: 0,
              minNumbers: 1,
              minSymbols: 0,
              returnScore: false,
            })
          ) {
            throwGraphQLError(
              'password.invalid',
              'Password must contain at least 1 number and must be 8 characters long',
              context
            )
          }

          await strapi.plugins['users-permissions'].controllers.auth.register(context)
          const output = context.body.toJSON ? context.body.toJSON() : context.body

          checkBadRequest(output)
          return {
            user: output.user || output,
            jwt: output.jwt,
          }
        },
      },
      sendEmailConfirmation: {
        description: 'Sends email confirmation',
        resolverOf: 'plugins::users-permissions.auth.sendEmailConfirmation',
        resolver: async (_obj, options, { context }) => {
          context.request.body = _.toPlainObject(options.input)

          // check if user exists first
          const [user] = await strapi.plugins['users-permissions'].services.user.fetchAll({
            email: options.input.email,
          })
          if (!user) {
            throwGraphQLError(
              'user.not.found',
              `User cannot be found with email ${options.input.email}`,
              context
            )
          }

          await strapi.plugins['users-permissions'].controllers.auth.sendEmailConfirmation(context)
          const output = context.body.toJSON ? context.body.toJSON() : context.body

          checkBadRequest(output)
          return {
            email: output.email,
            sent: true,
          }
        },
      },
    },
  },
}
