const createWorkoutVideo = require('./helpers/createWorkoutVideo')
const createSubscription = require('./helpers/createSubscription')
const createUser = require('./helpers/createUser')
const getJwt = require('./helpers/getJwt')
const { GraphQLClient, gql } = require('graphql-request')
const getPort = require('get-port')

const GET_VIDEOS = gql`
  {
    workoutVideos {
      id
      title
      code
    }
  }
`

const GET_VIDEO_BY_CODE = gql`
  query GetPremiumVideo($id: ID!) {
    workoutVideo(id: $id) {
      id
      title
      code
    }
  }
`

describe('Workout video model', () => {
  let starterVideo
  let premiumVideo
  let starterSubscription
  let premiumSubscription
  let port
  let endPoint
  beforeAll(async () => {
    port = await getPort()
    strapi.server.listen(port)
    endPoint = `http://localhost:${port}/graphql`

    starterSubscription = await createSubscription()
    premiumSubscription = await createSubscription({ fullAccess: true })
    starterVideo = await createWorkoutVideo({ subscription: starterSubscription })
    premiumVideo = await createWorkoutVideo({ subscription: premiumSubscription })
  })

  afterAll(() => {
    strapi.server.close()
  })

  describe('find', () => {
    it('Gets no video when user is not authenticated', async () => {
      const graphQLClient = new GraphQLClient(endPoint)
      let error
      try {
        await graphQLClient.request(GET_VIDEOS)
      } catch (e) {
        error = e
      }

      expect(error.response?.errors[0]?.message).toEqual('Forbidden')
    })

    it('Does not get subscriber videos if user is authenticated without active subscription', async () => {
      const user = await createUser()
      const jwt = await getJwt(user.id)

      const graphQLClient = new GraphQLClient(endPoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })
      const { workoutVideos } = await graphQLClient.request(GET_VIDEOS)

      const subscriberVideos = workoutVideos.filter(
        (video) => video.id === starterVideo.id || video.id === premiumVideo.id
      )
      expect(subscriberVideos).toHaveLength(0)
    })

    it('Does not get subscriber videos if user is authenticated an expired subscription', async () => {
      const end = new Date()
      end.setDate(end.getDate() - 1)
      const user = await createUser({
        subscriptionEnd: end,
        subscriptionActive: true,
        subscription: starterSubscription.id,
      })
      const jwt = await getJwt(user.id)

      const graphQLClient = new GraphQLClient(endPoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })
      const { workoutVideos } = await graphQLClient.request(GET_VIDEOS)

      const subscriberVideos = workoutVideos.filter(
        (video) => video.id === starterVideo.id || video.id === premiumVideo.id
      )
      expect(subscriberVideos).toHaveLength(0)
    })

    it('Does not get subscriber videos if user is authenticated an inactive subscription', async () => {
      const end = new Date()
      end.setMonth(end.getMonth() + 1)
      const user = await createUser({
        subscriptionEnd: end,
        subscriptionActive: false,
        subscription: starterSubscription.id,
      })
      const jwt = await getJwt(user.id)

      const graphQLClient = new GraphQLClient(endPoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })
      const { workoutVideos } = await graphQLClient.request(GET_VIDEOS)

      const subscriberVideos = workoutVideos.filter(
        (video) => video.id === starterVideo.id || video.id === premiumVideo.id
      )
      expect(subscriberVideos).toHaveLength(0)
    })

    it('Gets only starter videos if user is authenticated and has an active starter subscription', async () => {
      const end = new Date()
      end.setMonth(end.getMonth() + 1)
      const user = await createUser({
        subscriptionEnd: end,
        subscriptionActive: true,
        subscription: starterSubscription,
      })
      const jwt = await getJwt(user.id)

      const graphQLClient = new GraphQLClient(endPoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })
      const { workoutVideos } = await graphQLClient.request(GET_VIDEOS)

      const subscriberVideos = workoutVideos.filter(
        (video) =>
          video.id === starterVideo.id.toString() || video.id === premiumVideo.id.toString()
      )
      expect(subscriberVideos).toEqual([
        { id: starterVideo.id.toString(), title: starterVideo.title, code: starterVideo.code },
      ])
    })

    it('Gets all videos if user is authenticated and has an active premium subscription', async () => {
      const end = new Date()
      end.setMonth(end.getMonth() + 1)
      const user = await createUser({
        subscriptionEnd: end,
        subscriptionActive: true,
        subscription: premiumSubscription,
      })
      const jwt = await getJwt(user.id)

      const graphQLClient = new GraphQLClient(endPoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })
      const { workoutVideos } = await graphQLClient.request(GET_VIDEOS)

      const premiumVideoFromDb = workoutVideos.find(({ id }) => id === premiumVideo.id.toString())
      const starterVideoFromDb = workoutVideos.find(({ id }) => id === starterVideo.id.toString())

      expect(workoutVideos).toHaveLength(2)
      expect(premiumVideoFromDb).toBeTruthy()
      expect(starterVideoFromDb).toBeTruthy()
    })
  })

  describe('findOne', () => {
    it('Gets no video when user is not authenticated', async () => {
      const graphQLClient = new GraphQLClient(endPoint)
      let error
      try {
        await graphQLClient.request(GET_VIDEO_BY_CODE, { id: starterVideo.id })
      } catch (e) {
        error = e
      }

      expect(error.response?.errors[0]?.message).toEqual('Forbidden')
    })

    it('Does not get subscriber video if user is authenticated without active subscription', async () => {
      const user = await createUser()
      const jwt = await getJwt(user.id)

      const graphQLClient = new GraphQLClient(endPoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })
      const { workoutVideo } = await graphQLClient.request(GET_VIDEO_BY_CODE, {
        id: starterVideo.id,
      })

      expect(workoutVideo).toBeNull()
    })

    it('Does not get subscriber video if user is authenticated an expired subscription', async () => {
      const end = new Date()
      end.setDate(end.getDate() - 1)
      const user = await createUser({
        subscriptionEnd: end,
        subscriptionActive: true,
        subscription: starterSubscription.id,
      })
      const jwt = await getJwt(user.id)

      const graphQLClient = new GraphQLClient(endPoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })
      const { workoutVideo } = await graphQLClient.request(GET_VIDEO_BY_CODE, {
        id: starterVideo.id,
      })

      expect(workoutVideo).toBeNull()
    })

    it('Does not get subscriber video if user is authenticated an inactive subscription', async () => {
      const end = new Date()
      end.setMonth(end.getMonth() + 1)
      const user = await createUser({
        subscriptionEnd: end,
        subscriptionActive: false,
        subscription: starterSubscription.id,
      })
      const jwt = await getJwt(user.id)

      const graphQLClient = new GraphQLClient(endPoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })
      const { workoutVideo } = await graphQLClient.request(GET_VIDEO_BY_CODE, {
        id: starterVideo.id,
      })

      expect(workoutVideo).toBeNull()
    })

    it('Does not get premium video if user is authenticated and has an active starter subscription', async () => {
      const end = new Date()
      end.setMonth(end.getMonth() + 1)
      const user = await createUser({
        subscriptionEnd: end,
        subscriptionActive: true,
        subscription: starterSubscription,
      })
      const jwt = await getJwt(user.id)

      const graphQLClient = new GraphQLClient(endPoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })
      const { workoutVideo } = await graphQLClient.request(GET_VIDEO_BY_CODE, {
        id: premiumVideo.id,
      })

      expect(workoutVideo).toBeNull()
    })

    it('Gets starter video if user is authenticated and has an active starter subscription', async () => {
      const end = new Date()
      end.setMonth(end.getMonth() + 1)
      const user = await createUser({
        subscriptionEnd: end,
        subscriptionActive: true,
        subscription: starterSubscription,
      })
      const jwt = await getJwt(user.id)

      const graphQLClient = new GraphQLClient(endPoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })
      const { workoutVideo } = await graphQLClient.request(GET_VIDEO_BY_CODE, {
        id: starterVideo.id,
      })

      expect(workoutVideo).toMatchObject({
        id: starterVideo.id.toString(),
        title: starterVideo.title,
        code: starterVideo.code,
      })
    })

    it('Gets premium video if user is authenticated and has an active premium subscription', async () => {
      const end = new Date()
      end.setMonth(end.getMonth() + 1)
      const user = await createUser({
        subscriptionEnd: end,
        subscriptionActive: true,
        subscription: premiumSubscription,
      })
      const jwt = await getJwt(user.id)

      const graphQLClient = new GraphQLClient(endPoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })
      const { workoutVideo } = await graphQLClient.request(GET_VIDEO_BY_CODE, {
        id: premiumVideo.id,
      })

      expect(workoutVideo).toMatchObject({
        id: premiumVideo.id.toString(),
        title: premiumVideo.title,
        code: premiumVideo.code,
      })
    })
  })
})
