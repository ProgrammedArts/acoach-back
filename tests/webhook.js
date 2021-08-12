const request = require('supertest')
const stripe = require('stripe')
const getPort = require('get-port')
const createUser = require('./helpers/createUser')
const createSubscription = require('./helpers/createSubscription')

describe('Webhook', () => {
  // when this is called a stripe event is handled
  let fetchAllSpy
  let editSpy
  const errorMock = jest.spyOn(console, 'error').mockImplementation()
  let port

  beforeAll(async () => {
    port = await getPort()
    strapi.server.listen(port)
    fetchAllSpy = jest.spyOn(strapi.plugins['users-permissions'].services.user, 'fetchAll')
    editSpy = jest.spyOn(strapi.plugins['users-permissions'].services.user, 'edit')
  })

  afterAll(() => {
    strapi.server.close()
    fetchAllSpy.mockRestore()
    editSpy.mockRestore()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('Does not handle event if the webhook signature is invalid', async () => {
    const {
      webhooks: { constructEvent },
    } = stripe()
    constructEvent.mockImplementation(() => {
      throw new Error()
    })

    await request.agent(strapi.server).post('/webhook').send({}).expect(400)

    expect(fetchAllSpy).not.toHaveBeenCalled()
    expect(errorMock).toHaveBeenCalledTimes(1)
  })

  it('Does not handle event if there is no webhook secret', async () => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    process.env.STRIPE_WEBHOOK_SECRET = ''

    await request.agent(strapi.server).post('/webhook').send({}).expect(400)

    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret
    expect(fetchAllSpy).not.toHaveBeenCalled()
    expect(errorMock).toHaveBeenCalledTimes(1)
  })

  it('Enables a subscription for a user after paying', async () => {
    const stripeCustomer = stripe.builders.customer()
    const user = await createUser({ stripeCustomerId: stripeCustomer.id })
    const subscriptionItem = stripe.builders.subscriptionItem()
    const product = subscriptionItem.price.product
    const subscription = await createSubscription({ stripeProductId: product })
    const stripeSubscription = stripe.builders.subscription({
      items: {
        object: 'list',
        data: [subscriptionItem],
        has_more: false,
        url: `/v1/subscription_items?subscription=${subscriptionItem.subscription}`,
      },
    })

    // stripe mocks
    const {
      subscriptions: { retrieve },
      webhooks: { constructEvent },
    } = stripe()
    retrieve.mockImplementationOnce(() => Promise.resolve(stripeSubscription))
    constructEvent.mockReturnValueOnce({
      data: { object: { customer: stripeCustomer.id } },
      type: 'invoice.paid',
    })

    await request.agent(strapi.server).post('/webhook').send({}).expect(200)

    // verify that user has its subscription activated
    const userWithSub = await strapi.plugins['users-permissions'].services.user.fetch({
      id: user.id,
    })
    expect(userWithSub.subscriptionActive).toBeTruthy()
    expect(userWithSub.subscriptionStart).toEqual(
      new Date(stripeSubscription.current_period_start * 1000).toISOString()
    )
    expect(userWithSub.subscriptionEnd).toEqual(
      new Date(stripeSubscription.current_period_end * 1000).toISOString()
    )
    expect(userWithSub.subscription).toMatchObject(subscription)
  })

  it('Does not enable subscription if user is not found', async () => {
    const stripeCustomer = stripe.builders.customer()
    await createUser()
    const subscriptionItem = stripe.builders.subscriptionItem()
    const product = subscriptionItem.price.product
    await createSubscription({ stripeProductId: product })
    const stripeSubscription = stripe.builders.subscription({
      items: {
        object: 'list',
        data: [subscriptionItem],
        has_more: false,
        url: `/v1/subscription_items?subscription=${subscriptionItem.subscription}`,
      },
    })

    // stripe mocks
    const {
      subscriptions: { retrieve },
      webhooks: { constructEvent },
    } = stripe()
    retrieve.mockImplementationOnce(() => Promise.resolve(stripeSubscription))
    constructEvent.mockReturnValueOnce({
      data: { object: { customer: stripeCustomer.id } },
      type: 'invoice.paid',
    })

    await request.agent(strapi.server).post('/webhook').send({}).expect(200)

    expect(editSpy).not.toHaveBeenCalled()
  })

  it('Does not enable subscription if subscription plan is not found', async () => {
    const stripeCustomer = stripe.builders.customer()
    await createUser()
    const subscriptionItem = stripe.builders.subscriptionItem()
    const stripeSubscription = stripe.builders.subscription({
      items: {
        object: 'list',
        data: [subscriptionItem],
        has_more: false,
        url: `/v1/subscription_items?subscription=${subscriptionItem.subscription}`,
      },
    })

    // stripe mocks
    const {
      subscriptions: { retrieve },
      webhooks: { constructEvent },
    } = stripe()
    retrieve.mockImplementationOnce(() => Promise.resolve(stripeSubscription))
    constructEvent.mockReturnValueOnce({
      data: { object: { customer: stripeCustomer.id } },
      type: 'invoice.paid',
    })

    await request.agent(strapi.server).post('/webhook').send({}).expect(200)

    expect(editSpy).not.toHaveBeenCalled()
  })

  it('Revokes subscription access if payment has failed', async () => {
    const stripeCustomer = stripe.builders.customer()
    const user = await createUser({ stripeCustomerId: stripeCustomer.id })
    const subscriptionItem = stripe.builders.subscriptionItem()
    const product = subscriptionItem.price.product
    const subscription = await createSubscription({ stripeProductId: product })
    const stripeSubscription = stripe.builders.subscription({
      items: {
        object: 'list',
        data: [subscriptionItem],
        has_more: false,
        url: `/v1/subscription_items?subscription=${subscriptionItem.subscription}`,
      },
    })

    // stripe mocks
    const {
      subscriptions: { retrieve },
      webhooks: { constructEvent },
    } = stripe()
    retrieve.mockImplementationOnce(() => Promise.resolve(stripeSubscription))
    constructEvent.mockReturnValueOnce({
      data: { object: { customer: stripeCustomer.id } },
      type: 'invoice.paid',
    })

    // activate subscription
    await request.agent(strapi.server).post('/webhook').send({}).expect(200)

    // simulate payment failure
    constructEvent.mockReturnValueOnce({
      data: { object: { customer: stripeCustomer.id } },
      type: 'invoice.payment_failed',
    })
    await request.agent(strapi.server).post('/webhook').send({}).expect(200)

    // verify that user has its subscription disabled
    const userWithSub = await strapi.plugins['users-permissions'].services.user.fetch({
      id: user.id,
    })
    expect(userWithSub.subscriptionStart).toEqual(
      new Date(stripeSubscription.current_period_start * 1000).toISOString()
    )
    expect(userWithSub.subscriptionEnd).toEqual(
      new Date(stripeSubscription.current_period_end * 1000).toISOString()
    )
    expect(userWithSub.subscription).toMatchObject(subscription)
    expect(userWithSub.subscriptionActive).toBeFalsy()
  })

  it('Revokes subscription access if the subscription has been immediately terminated', async () => {
    const stripeCustomer = stripe.builders.customer()
    const user = await createUser({ stripeCustomerId: stripeCustomer.id })
    const subscriptionItem = stripe.builders.subscriptionItem()
    const product = subscriptionItem.price.product
    const subscription = await createSubscription({ stripeProductId: product })
    const stripeSubscription = stripe.builders.subscription({
      items: {
        object: 'list',
        data: [subscriptionItem],
        has_more: false,
        url: `/v1/subscription_items?subscription=${subscriptionItem.subscription}`,
      },
    })

    // stripe mocks
    const {
      subscriptions: { retrieve },
      webhooks: { constructEvent },
    } = stripe()
    retrieve.mockImplementationOnce(() => Promise.resolve(stripeSubscription))
    constructEvent.mockReturnValueOnce({
      data: { object: { customer: stripeCustomer.id } },
      type: 'invoice.paid',
    })

    // activate subscription
    await request.agent(strapi.server).post('/webhook').send({}).expect(200)

    // terminate subscrpition
    constructEvent.mockReturnValueOnce({
      data: { object: { customer: stripeCustomer.id } },
      type: 'customer.subscription.deleted',
    })
    await request.agent(strapi.server).post('/webhook').send({}).expect(200)

    // verify that user has its subscription disabled
    const userWithSub = await strapi.plugins['users-permissions'].services.user.fetch({
      id: user.id,
    })
    expect(userWithSub.subscriptionStart).toEqual(
      new Date(stripeSubscription.current_period_start * 1000).toISOString()
    )
    expect(userWithSub.subscriptionEnd).toEqual(
      new Date(stripeSubscription.current_period_end * 1000).toISOString()
    )
    expect(userWithSub.subscription).toMatchObject(subscription)
    expect(userWithSub.subscriptionActive).toBeFalsy()
  })
})
