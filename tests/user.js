const { GraphQLClient, gql } = require('graphql-request')
const getPort = require('get-port')
const faker = require('faker')
const createUser = require('./helpers/createUser')
const createSubscription = require('./helpers/createSubscription')
const getJwt = require('./helpers/getJwt')

const SIGN_UP = gql`
  mutation SignUp($username: String!, $email: String!, $password: String!, $realname: String!) {
    registerWithRealName(
      input: { username: $username, email: $email, password: $password, realname: $realname }
    ) {
      jwt
    }
  }
`

const SEND_EMAIL_CONFIRMATION = gql`
  mutation SendEmailConfirmation($email: String!) {
    sendEmailConfirmation(input: { email: $email }) {
      email
      sent
    }
  }
`

const CHANGE_PASSWORD = gql`
  mutation ChangePassword($password: String!, $newPassword: String!) {
    changePassword(input: { password: $password, newPassword: $newPassword }) {
      email
    }
  }
`

const ME = gql`
  {
    me {
      id
      email
      subscription {
        id
        name
      }
    }
  }
`

describe('User extension', () => {
  let port
  let endPoint
  beforeAll(async () => {
    port = await getPort()
    strapi.server.listen(port)
    endPoint = `http://localhost:${port}/graphql`
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    strapi.server.close()
  })

  it('Registers with a realname', async () => {
    const email = faker.internet.email().toLowerCase()
    const name = faker.name.firstName()
    const password = faker.internet.password()

    const graphQLClient = new GraphQLClient(endPoint)
    const data = await graphQLClient.request(SIGN_UP, {
      username: email,
      email,
      realname: name,
      password,
    })

    expect(data?.registerWithRealName.jwt).toBeDefined()

    const [user] = await strapi.plugins['users-permissions'].services.user.fetchAll({ email })

    expect(user).toMatchObject({
      username: email,
      email,
      realname: name,
    })
  })

  it('Registration fails if password is not long enough', async () => {
    const email = faker.internet.email().toLowerCase()
    const name = faker.name.firstName()
    const password = faker.internet.password(3)

    const graphQLClient = new GraphQLClient(endPoint)

    let error
    try {
      await graphQLClient.request(SIGN_UP, {
        username: email,
        email,
        realname: name,
        password,
      })
    } catch (e) {
      error = e
    }
    const strapiError = error.response?.errors[0].extensions.exception.data.message[0].messages[0]
    expect(strapiError.id).toEqual('password.invalid')
    expect(strapiError.message).toContain(
      'Password must contain at least 1 number and must be 8 characters long'
    )

    const [user] = await strapi.plugins['users-permissions'].services.user.fetchAll({ email })
    expect(user).not.toBeDefined()
  })

  it('Registration fails if password does not have a number', async () => {
    const email = faker.internet.email().toLowerCase()
    const name = faker.name.firstName()
    const password = faker.random.alpha(10)

    const graphQLClient = new GraphQLClient(endPoint)

    let error
    try {
      await graphQLClient.request(SIGN_UP, {
        username: email,
        email,
        realname: name,
        password,
      })
    } catch (e) {
      error = e
    }
    const strapiError = error.response?.errors[0].extensions.exception.data.message[0].messages[0]
    expect(strapiError.id).toEqual('password.invalid')
    expect(strapiError.message).toContain(
      'Password must contain at least 1 number and must be 8 characters long'
    )

    const [user] = await strapi.plugins['users-permissions'].services.user.fetchAll({ email })
    expect(user).not.toBeDefined()
  })

  it('Sends an email confirmation', async () => {
    const user = await createUser()
    const mockSendEmailConfirmation = jest
      .spyOn(strapi.plugins['users-permissions'].controllers.auth, 'sendEmailConfirmation')
      .mockImplementation((ctx) => {
        ctx.body = {
          toJSON: () => ({ email: user.email }),
        }
      })

    const graphQLClient = new GraphQLClient(endPoint)
    const data = await graphQLClient.request(SEND_EMAIL_CONFIRMATION, {
      email: user.email,
    })

    expect(data.sendEmailConfirmation.email).toEqual(user.email)
    expect(data.sendEmailConfirmation.sent).toBe(true)
    expect(mockSendEmailConfirmation).toHaveBeenCalledTimes(1)
  })

  it('Does not send email confirmation if user is not found', async () => {
    const email = faker.internet.email().toLowerCase()
    const mockSendEmailConfirmation = jest
      .spyOn(strapi.plugins['users-permissions'].controllers.auth, 'sendEmailConfirmation')
      .mockImplementation((ctx) => {
        ctx.body = {
          toJSON: () => ({ email }),
        }
      })

    const graphQLClient = new GraphQLClient(endPoint)

    let error
    try {
      await graphQLClient.request(SEND_EMAIL_CONFIRMATION, {
        email,
      })
    } catch (e) {
      error = e
    }
    const strapiError = error.response?.errors[0].extensions.exception.data.message[0].messages[0]
    expect(strapiError.id).toEqual('user.not.found')
    expect(strapiError.message).toContain('User cannot be found with email ')
    expect(mockSendEmailConfirmation).toHaveBeenCalledTimes(0)
  })

  it('Fails to change password if current password is not valid', async () => {
    const user = await createUser({
      password: 'p4ssw0rd',
    })
    const jwt = getJwt(user.id)
    const graphQLClient = new GraphQLClient(endPoint, {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    })

    let error
    try {
      await graphQLClient.request(CHANGE_PASSWORD, {
        password: 'notThePassword',
        newPassword: 'n3wP4ssw0rd',
      })
    } catch (e) {
      error = e
    }
    const strapiError = error.response?.errors[0].extensions.exception.data.message[0].messages[0]
    expect(strapiError.id).toEqual('current.password.invalid')
  })

  it('Fails to change password if the new password is not valid', async () => {
    const user = await createUser({
      password: 'p4ssw0rd',
    })
    const jwt = getJwt(user.id)
    const graphQLClient = new GraphQLClient(endPoint, {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    })

    let error
    try {
      await graphQLClient.request(CHANGE_PASSWORD, {
        password: 'p4ssw0rd',
        newPassword: 'badpw',
      })
    } catch (e) {
      error = e
    }
    const strapiError = error.response?.errors[0].extensions.exception.data.message[0].messages[0]
    expect(strapiError.id).toEqual('password.invalid')
  })

  it('Changes password successfully', async () => {
    const user = await createUser({
      password: 'p4ssw0rd',
    })
    const jwt = getJwt(user.id)
    const graphQLClient = new GraphQLClient(endPoint, {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    })

    const newPassword = 'n3wP4ssw0rd'
    await graphQLClient.request(CHANGE_PASSWORD, {
      password: 'p4ssw0rd',
      newPassword,
    })

    // check password
    const userWithNewPw = await strapi.plugins['users-permissions'].services.user.fetch({
      id: user.id,
    })
    const validation = await strapi.plugins['users-permissions'].services.user.validatePassword(
      newPassword,
      userWithNewPw.password
    )
    expect(validation).toBeTruthy()
  })

  it('Does not send me if not authenticated', async () => {
    const graphQLClient = new GraphQLClient(endPoint)

    const data = await graphQLClient.request(ME)
    expect(data.me).toBeNull()
  })

  it('Send me with subscription if authenticated', async () => {
    const subscription = await createSubscription()
    const end = new Date()
    end.setDate(end.getDate() + 1)
    const user = await createUser({
      subscriptionEnd: end,
      subscriptionActive: true,
      subscription: subscription.id,
    })
    const jwt = getJwt(user.id)
    const graphQLClient = new GraphQLClient(endPoint, {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    })

    const data = await graphQLClient.request(ME)
    expect(data.me).toMatchObject({
      id: user.id.toString(),
      email: user.email,
      subscription: {
        id: subscription.id.toString(),
        name: subscription.name,
      },
    })
  })
})
