const createUser = require('./helpers/createUser')
const createSubscription = require('./helpers/createSubscription')
const getJwt = require('./helpers/getJwt')
const { GraphQLClient, gql } = require('graphql-request')
const getPort = require('get-port')
const stripe = require('stripe')
const faker = require('faker')

const FIND_CUSTOMER = gql`
  mutation Checkout($subscriptionId: ID!) {
    createCheckout(input: { subscriptionId: $subscriptionId }) {
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

  it('Creates a Stripe customer and a checkout session for a subscription', async () => {
    const user = await createUser()
    const jwt = getJwt(user.id)
    const subscription = await createSubscription()

    const graphQLClient = new GraphQLClient(endPoint, {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    })
    const data = await graphQLClient.request(FIND_CUSTOMER, {
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
    const stripeCustomerId = `cus_${faker.random.alphaNumeric(15)}`
    const user = await createUser({ stripeCustomerId })
    const jwt = getJwt(user.id)
    const subscription = await createSubscription()

    const graphQLClient = new GraphQLClient(endPoint, {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    })
    const data = await graphQLClient.request(FIND_CUSTOMER, {
      subscriptionId: subscription.id,
    })

    expect(data.createCheckout.url).toBeDefined()

    // user should have the same customer ID
    const updatedUser = await strapi.plugins['users-permissions'].services.user.fetch({
      id: user.id,
    })
    expect(updatedUser.stripeCustomerId).toEqual(stripeCustomerId)
    const mockCreateCustomer = stripe().customers.create
    expect(mockCreateCustomer).not.toHaveBeenCalled()

    // checkout session should have been called with a price id that was obtained from the subscription product
    const mockCheckoutCreateSession = stripe().checkout.sessions.create
    expect(mockCheckoutCreateSession).toHaveBeenCalledTimes(1)
    expect(mockCheckoutCreateSession.mock.calls[0][0].line_items[0].price).toBeDefined()
  })

  it('Does not do anything if subscription does not exist', async () => {
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
    const data = await graphQLClient.request(FIND_CUSTOMER, {
      subscriptionId: subscription.id,
    })

    expect(data.createCheckout.url).toBeFalsy()
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
      await graphQLClient.request(FIND_CUSTOMER, {
        subscriptionId: subscription.id,
      })
    } catch (e) {
      error = e
    }
    expect(error.response?.errors[0]?.message).toEqual('Forbidden')
  })
})
