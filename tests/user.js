const { GraphQLClient, gql } = require('graphql-request')
const getPort = require('get-port')
const faker = require('faker')
const createUser = require('./helpers/createUser')

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
})
