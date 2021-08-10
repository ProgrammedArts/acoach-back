const { GraphQLClient, gql } = require('graphql-request')
const getPort = require('get-port')
const faker = require('faker')

const SIGN_UP = gql`
  mutation SignUp($username: String!, $email: String!, $password: String!, $realname: String!) {
    registerWithRealName(
      input: { username: $username, email: $email, password: $password, realname: $realname }
    ) {
      jwt
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
})
