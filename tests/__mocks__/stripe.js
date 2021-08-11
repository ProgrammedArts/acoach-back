const { build, oneOf, fake } = require('test-data-bot')
const faker = require('faker/locale/fr')

const customerBuilder = build('StripeCustomer').fields({
  id: fake(() => `cus_${faker.random.alphaNumeric(15)}`),
  object: 'customer',
  address: null,
  balance: 0,
  created: fake(() => Math.floor(new Date().getTime() / 1000)),
  currency: 'eur',
  default_source: null,
  delinquent: false,
  description: null,
  discount: null,
  email: null,
  invoice_prefix: fake(() =>
    faker.random.alpha({
      upcase: true,
      count: 6,
    })
  ),
  invoice_settings: {
    custom_fields: null,
    default_payment_method: null,
    footer: null,
  },
  livemode: false,
  metadata: {},
  name: null,
  phone: null,
  preferred_locales: [],
  shipping: null,
  tax_exempt: 'none',
})

const priceBuilder = build('StripePrice')
  .fields({
    id: fake(() => `price_${faker.random.alphaNumeric(15)}`),
    object: 'price',
    active: true,
    billing_scheme: 'per_unit',
    created: fake(() => Math.floor(new Date().getTime() / 1000)),
    currency: 'eur',
    livemode: false,
    lookup_key: null,
    metadata: {},
    nickname: null,
    product: fake(() => `prod_${faker.random.alphaNumeric(15)}`),
    recurring: {
      aggregate_usage: null,
      interval: 'month',
      interval_count: 1,
      usage_type: 'licensed',
    },
    tax_behavior: 'unspecified',
    tiers_mode: null,
    transform_quantity: null,
    type: 'recurring',
    unit_amount: oneOf(500, 1000, 1500, 2000),
    unit_amount_decimal: null,
  })
  .map((price) => ({
    ...price,
    unit_amount_decimal: price.unit_amount.toString(),
  }))

const sessionBuilder = build('StripeSession').fields({
  id: fake(() => `cs_test_${faker.random.alphaNumeric(15)}`),
  object: 'checkout.session',
  allow_promotion_codes: null,
  amount_subtotal: null,
  amount_total: null,
  automatic_tax: {
    enabled: false,
    status: null,
  },
  billing_address_collection: null,
  cancel_url: fake(() => faker.internet.url()),
  client_reference_id: null,
  currency: null,
  customer: null,
  customer_details: null,
  customer_email: null,
  livemode: false,
  locale: null,
  metadata: {},
  mode: 'payment',
  payment_intent: fake(() => `pi_${faker.random.alphaNumeric(30)}`),
  payment_method_options: {},
  payment_method_types: ['card'],
  payment_status: 'unpaid',
  setup_intent: null,
  shipping: null,
  shipping_address_collection: null,
  submit_type: null,
  subscription: null,
  success_url: fake(() => faker.internet.url()),
  total_details: null,
  url: fake(() => faker.internet.url()),
})

const subscriptionItemBuilder = build('StripeSubscriptionItem').fields({
  id: fake(() => `si_${faker.random.alphaNumeric(15)}`),
  object: 'subscription_item',
  billing_thresholds: null,
  created: fake(() => Math.floor(new Date().getTime() / 1000)),
  metadata: {},
  price: fake(() => priceBuilder()),
  quantity: 1,
  subscription: `sub_${faker.random.alphaNumeric(15)}`,
  tax_rates: [],
})

const subscriptionBuilder = build('StripeSubscription')
  .fields({
    id: fake(() => `sub_${faker.random.alphaNumeric(15)}`),
    object: 'subscription',
    application_fee_percent: null,
    automatic_tax: {
      enabled: false,
    },
    billing_cycle_anchor: fake(() => Math.floor(new Date().getTime() / 1000)),
    billing_thresholds: null,
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    collection_method: 'charge_automatically',
    created: fake(() => Math.floor(new Date().getTime() / 1000)),
    current_period_end: fake(() => {
      const periodEnd = new Date()
      periodEnd.setMonth(periodEnd.getMonth() + 1)
      return Math.floor(periodEnd.getTime() / 1000)
    }),
    current_period_start: fake(() => Math.floor(new Date().getTime() / 1000)),
    customer: 'cus_JyqRvlUniuvWry',
    days_until_due: null,
    default_payment_method: 'pm_1JKsktIgUx88JzrX0I9ly1af',
    default_source: null,
    default_tax_rates: [],
    discount: null,
    ended_at: null,
    items: fake(() => {
      const subscriptionItem = subscriptionItemBuilder()
      return {
        object: 'list',
        data: [subscriptionItem],
        has_more: false,
        url: `/v1/subscription_items?subscription=${subscriptionItem.subscription}`,
      }
    }),
    latest_invoice: fake(() => `in_${faker.random.alphaNumeric(20)}`),
    livemode: false,
    metadata: {},
    next_pending_invoice_item_invoice: null,
    pause_collection: null,
    payment_settings: {
      payment_method_options: null,
      payment_method_types: null,
    },
    pending_invoice_item_interval: null,
    pending_setup_intent: null,
    pending_update: null,
    schedule: null,
    start_date: fake(() => Math.floor(new Date().getTime() / 1000)),
    status: 'active',
    transfer_data: null,
    trial_end: null,
    trial_start: null,
  })
  .map((subscription) => {
    const startDate = subscription.start_date
    return {
      ...subscription,
      billing_cycle_anchor: startDate,
      created: startDate,
      current_period_start: startDate,
    }
  })

const customerPortalBuilder = build('StripeCustomerPortal').fields({
  id: fake(() => `bps_${faker.random.alphaNumeric(20)}`),
  object: 'billing_portal.session',
  configuration: fake(() => `bpc_${faker.random.alphaNumeric(20)}`),
  created: fake(() => Math.floor(new Date().getTime() / 1000)),
  customer: fake(() => `cus_${faker.random.alphaNumeric(15)}`),
  livemode: true,
  locale: null,
  on_behalf_of: null,
  return_url: process.env.SITE_HOST,
  url: fake(() => `https://billing.stripe.com/session/${faker.random.alphaNumeric(20)}`),
})

const createCustomer = jest.fn((overrides = {}) => Promise.resolve(customerBuilder(overrides)))

const priceCreate = jest.fn((overrides = {}) => priceBuilder(overrides))

const priceList = jest.fn((overrides = {}) => Promise.resolve({ data: [priceBuilder(overrides)] }))

const createCheckoutSession = jest.fn((overrides = {}) =>
  Promise.resolve(sessionBuilder(overrides))
)

const webHookConstructEvent = jest.fn()

const retrieveSubscription = jest.fn((overrides = {}) => subscriptionBuilder(overrides))

const createCustomerPortal = jest.fn((overrides = {}) =>
  Promise.resolve(customerPortalBuilder(overrides))
)

module.exports = jest.fn(() => {
  const stripeModule = {
    customers: {
      create: createCustomer,
    },
    prices: {
      create: priceCreate,
      list: priceList,
    },
    checkout: {
      sessions: {
        create: createCheckoutSession,
      },
    },
    subscriptions: {
      retrieve: retrieveSubscription,
    },
    webhooks: {
      constructEvent: webHookConstructEvent,
    },
    billingPortal: {
      sessions: {
        create: createCustomerPortal,
      },
    },
  }

  return stripeModule
})

module.exports.builders = {
  subscription: subscriptionBuilder,
  subscriptionItem: subscriptionItemBuilder,
  customer: customerBuilder,
  session: sessionBuilder,
  price: priceBuilder,
  customerPortal: customerPortalBuilder,
}
