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
      subscription: Subscription
      subscriptionEnd: DateTime
      subscriptionActive: Boolean
    }

    input SendEmailConfirmationInput {
      email: String!
    }

    type SendEmailConfirmationResult {
      email: String!
      sent: Boolean!
    }

    input ChangePasswordInput {
      password: String!
      newPassword: String!
    }
  `,
  query: `
    
  `,
  mutation: `
    registerWithRealName(input: UsersPermissionsWithRealNameRegisterInput!): UsersPermissionsLoginPayload!
    sendEmailConfirmation(input: SendEmailConfirmationInput!): SendEmailConfirmationResult!
    changePassword(input: ChangePasswordInput!): UsersPermissionsMe
  `,
  type: {},
  resolver: {
    Query: {
      me: {
        resolverOf: 'plugins::users-permissions.user.me',
        resolver: async (_obj, _options, { context }) => {
          if (!context.state.user) {
            return context.badRequest(null, [
              { messages: [{ id: 'No authorization header was found' }] },
            ])
          }

          const user = await strapi.plugins['users-permissions'].services.user.fetch({
            id: context.state.user.id,
          })

          return user
        },
      },
    },
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
      changePassword: {
        description: 'Changes password without email',
        resolverOf: 'application::authenticated.authenticated.isAuthenticated',
        resolver: async (_obj, options, { context }) => {
          const { password, newPassword } = options.input

          // validate user
          const user = await strapi.plugins['users-permissions'].services.user.fetch({
            id: context.state.user.id,
          })

          if (!user) {
            throwGraphQLError('user.not.found', 'By some miracle the user does not exist', context)
          }
          const currentPasswordValidated = await strapi.plugins[
            'users-permissions'
          ].services.user.validatePassword(password, user.password)

          if (!currentPasswordValidated) {
            throwGraphQLError('current.password.invalid', 'Current password is invalid', context)
          }

          // validate password
          if (
            !isStrongPassword(newPassword, {
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

          const hashedNewPassword = await strapi.plugins[
            'users-permissions'
          ].services.user.hashPassword({
            password: newPassword,
          })

          // update the user
          return await strapi
            .query('user', 'users-permissions')
            .update({ id: user.id }, { resetPasswordToken: null, password: hashedNewPassword })
        },
      },
    },
  },
}
