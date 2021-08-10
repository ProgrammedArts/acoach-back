const createSubscription = require('./helpers/createSubscription')
const stripe = require('stripe')
const { gql, GraphQLClient } = require('graphql-request')
const getPort = require('get-port')

const GET_SUBSCRIPTIONS = gql`
  query {
    subscriptions {
      id
      name
      description
      price
    }
  }
`

describe('Subscription model', () => {
  let port
  let endPoint
  beforeAll(async () => {
    port = await getPort()
    strapi.server.listen(port)
    endPoint = `http://localhost:${port}/graphql`
  })

  afterAll(() => {
    strapi.server.close()
    jest.clearAllMocks()

    // restore list mock to the manual mock
    stripe().prices.list.mockImplementation((overrides = {}) =>
      Promise.resolve({ data: [priceBuilder(overrides)] })
    )
  })

  it('Gets the price from the product in subscriptions', async () => {
    const subscription1 = await createSubscription()
    const subscription2 = await createSubscription()

    const {
      prices: { list, create },
    } = stripe()
    const price1 = create({ unit_amount: 500 })
    const price2 = create({ unit_amount: 1000 })
    list.mockImplementation(({ product }) => {
      if (product === subscription1.stripeProductId) {
        return Promise.resolve({ data: [price1] })
      }
      if (product === subscription2.stripeProductId) {
        return Promise.resolve({ data: [price2] })
      }
      return Promise.resolve({ data: [create()] })
    })

    const graphQLClient = new GraphQLClient(endPoint)
    const data = await graphQLClient.request(GET_SUBSCRIPTIONS)

    const sub1WithPrice = data.subscriptions.find(
      (subscription) => subscription.id === subscription1.id.toString()
    )
    const sub2WithPrice = data.subscriptions.find(
      (subscription) => subscription.id === subscription2.id.toString()
    )

    expect(sub1WithPrice).toHaveProperty('price', 500)
    expect(sub1WithPrice).toHaveProperty('name', subscription1.name)
    expect(sub1WithPrice).toHaveProperty('description', subscription1.description)
    expect(sub2WithPrice).toHaveProperty('price', 1000)
    expect(sub2WithPrice).toHaveProperty('name', subscription2.name)
    expect(sub2WithPrice).toHaveProperty('description', subscription2.description)
  })
})
