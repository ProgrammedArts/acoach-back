const createUser = require('./helpers/createUser')
const createSubscription = require('./helpers/createSubscription')
const getJwt = require('./helpers/getJwt')
const { GraphQLClient, gql } = require('graphql-request')
const getPort = require('get-port')
const stripe = require('stripe')

const CREATE_CHECKOUT = gql`
  mutation Checkout($subscriptionId: ID!) {
    createCheckout(input: { subscriptionId: $subscriptionId }) {
      url
    }
  }
`

const GET_CUSTOMER_PORTAL = gql`
  query GetCustomerPortal {
    getCustomerPortal {
      url
    }
  }
`

describe('Stripe extension', () => {
  let port
  let endPoint
  beforeAll(async () => {
    port = await getPort()
    strapi.server.listen(port)
    endPoint = `http://localhost:${port}/graphql`
  })

  afterAll(() => {
    strapi.server.close()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Stripe checkout', () => {
    it('Creates a Stripe customer and a checkout session for a subscription', async () => {
      const user = await createUser()
      const jwt = getJwt(user.id)
      const subscription = await createSubscription()

      const graphQLClient = new GraphQLClient(endPoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })
      const data = await graphQLClient.request(CREATE_CHECKOUT, {
        subscriptionId: subscription.id,
      })

      expect(data.createCheckout.url).toBeDefined()

      // user should have a customer ID
      const updatedUser = await strapi.plugins['users-permissions'].services.user.fetch({
        id: user.id,
      })
      expect(updatedUser.stripeCustomerId).toBeDefined()

      // checkout session should have been called with a price id that was obtained from the subscription product
      const mockCheckoutCreateSession = stripe().checkout.sessions.create
      expect(mockCheckoutCreateSession).toHaveBeenCalledTimes(1)
      expect(mockCheckoutCreateSession.mock.calls[0][0].line_items[0].price).toBeDefined()
    })

    it('Creates a checkout session for a subscription with an existing stripe customer', async () => {
      const { create } = stripe().customers
      const customer = await create()
      const user = await createUser({ stripeCustomerId: customer.id })
      const jwt = getJwt(user.id)
      const subscription = await createSubscription()

      // clear customer create mock
      create.mockClear()

      const graphQLClient = new GraphQLClient(endPoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })
      const data = await graphQLClient.request(CREATE_CHECKOUT, {
        subscriptionId: subscription.id,
      })

      expect(data.createCheckout.url).toBeDefined()

      // user should have the same customer ID
      const updatedUser = await strapi.plugins['users-permissions'].services.user.fetch({
        id: user.id,
      })
      expect(updatedUser.stripeCustomerId).toEqual(customer.id)
      expect(create).not.toHaveBeenCalled()

      // checkout session should have been called with a price id that was obtained from the subscription product
      const mockCheckoutCreateSession = stripe().checkout.sessions.create
      expect(mockCheckoutCreateSession).toHaveBeenCalledTimes(1)
      expect(mockCheckoutCreateSession.mock.calls[0][0].line_items[0].price).toBeDefined()
    })

    it('Errors if subscription does not exist', async () => {
      const user = await createUser()
      const jwt = getJwt(user.id)
      const subscription = await createSubscription()

      // remove subscription from the db
      await strapi.services.subscription.delete(subscription)

      const graphQLClient = new GraphQLClient(endPoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })

      let error
      try {
        await graphQLClient.request(CREATE_CHECKOUT, {
          subscriptionId: subscription.id,
        })
      } catch (e) {
        error = e
      }
      const strapiError = error.response?.errors[0].extensions.exception.data.message[0].messages[0]
      expect(strapiError.id).toEqual('Stripe.subscription.not.found')
      expect(strapiError.message).toContain('Subscription not found')

      const {
        customers: { create: customerCreate },
        prices: { list },
        checkout: {
          sessions: { create: sessionCreate },
        },
      } = stripe()
      expect(customerCreate).not.toHaveBeenCalled()
      expect(list).not.toHaveBeenCalled()
      expect(sessionCreate).not.toHaveBeenCalled()
    })

    it('Errors if user is not authenticated', async () => {
      const subscription = await createSubscription()

      const graphQLClient = new GraphQLClient(endPoint)

      let error
      try {
        await graphQLClient.request(CREATE_CHECKOUT, {
          subscriptionId: subscription.id,
        })
      } catch (e) {
        error = e
      }
      expect(error.response?.errors[0]?.message).toEqual('Forbidden')
    })

    it('Errors if user already has an active subscription', async () => {
      const subscription = await createSubscription()
      const end = new Date()
      end.setDate(end.getDate() + 1)
      const user = await createUser({
        subscriptionEnd: end,
        subscriptionActive: true,
        subscription: subscription.id,
      })
      const jwt = getJwt(user.id)
      const {
        prices: { list },
        checkout: {
          sessions: { create: sessionCreate },
        },
      } = stripe()

      const graphQLClient = new GraphQLClient(endPoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })

      let error
      try {
        await graphQLClient.request(CREATE_CHECKOUT, {
          subscriptionId: subscription.id,
        })
      } catch (e) {
        error = e
      }
      const strapiError = error.response?.errors[0].extensions.exception.data.message[0].messages[0]
      expect(strapiError.id).toEqual('Stripe.user.already.subscribed')
      expect(strapiError.message).toContain('already has an active subscription')
      expect(list).not.toHaveBeenCalled()
      expect(sessionCreate).not.toHaveBeenCalled()
    })

    it('Errors if user already has a suspended subscription', async () => {
      const subscription = await createSubscription()
      const end = new Date()
      end.setDate(end.getDate() + 1)
      const user = await createUser({
        subscriptionEnd: end,
        subscriptionActive: false,
        subscription: subscription.id,
      })
      const jwt = getJwt(user.id)
      const {
        prices: { list },
        checkout: {
          sessions: { create: sessionCreate },
        },
      } = stripe()

      const graphQLClient = new GraphQLClient(endPoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })

      let error
      try {
        await graphQLClient.request(CREATE_CHECKOUT, {
          subscriptionId: subscription.id,
        })
      } catch (e) {
        error = e
      }
      const strapiError = error.response?.errors[0].extensions.exception.data.message[0].messages[0]
      expect(strapiError.id).toEqual('Stripe.user.already.subscribed')
      expect(strapiError.message).toContain('already has an active subscription')
      expect(list).not.toHaveBeenCalled()
      expect(sessionCreate).not.toHaveBeenCalled()
    })

    it('Errors if price is not found on Stripe', async () => {
      const user = await createUser()
      const jwt = getJwt(user.id)
      const subscription = await createSubscription()
      const {
        prices: { list },
        checkout: {
          sessions: { create: sessionCreate },
        },
      } = stripe()

      list.mockResolvedValueOnce({ data: [] })

      const graphQLClient = new GraphQLClient(endPoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })

      let error
      try {
        await graphQLClient.request(CREATE_CHECKOUT, {
          subscriptionId: subscription.id,
        })
      } catch (e) {
        error = e
      }
      const strapiError = error.response?.errors[0].extensions.exception.data.message[0].messages[0]
      expect(strapiError.id).toEqual('Stripe.product.not.found')
      expect(strapiError.message).toContain('No Stripe product or price for ')
      expect(sessionCreate).not.toHaveBeenCalled()
    })
  })

  describe('Stripe customer portal', () => {
    it('Errors if user is not authenticated', async () => {
      const graphQLClient = new GraphQLClient(endPoint)

      let error
      try {
        await graphQLClient.request(GET_CUSTOMER_PORTAL)
      } catch (e) {
        error = e
      }
      expect(error.response?.errors[0]?.message).toEqual('Forbidden')
    })

    it('Errors if user does not have a stripe customer id', async () => {
      const user = await createUser()
      const jwt = await getJwt(user.id)
      const graphQLClient = new GraphQLClient(endPoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })

      let error
      try {
        await graphQLClient.request(GET_CUSTOMER_PORTAL)
      } catch (e) {
        error = e
      }
      const strapiError = error.response?.errors[0].extensions.exception.data.message[0].messages[0]
      expect(strapiError.id).toEqual('Stripe.user.not.found')
      expect(strapiError.message).toContain('User does not have a Stripe customer id')
      expect(stripe().billingPortal.sessions.create).not.toHaveBeenCalled()
    })

    it('Gets a customer portal url if user has a stripe customer id', async () => {
      const customer = await stripe().customers.create()
      const user = await createUser({ stripeCustomerId: customer.id })
      const jwt = await getJwt(user.id)
      const graphQLClient = new GraphQLClient(endPoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })

      const data = await graphQLClient.request(GET_CUSTOMER_PORTAL)

      expect(data?.getCustomerPortal.url).toBeTruthy()
    })
  })
})
