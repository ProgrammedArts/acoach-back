const _ = require('lodash')
const fetch = require('node-fetch').default

module.exports = {
  definition: `
      extend type WorkoutVideo {
        otp: String
        playbackInfo: String
      }
    `,
  query: ``,
  mutation: ``,
  type: {},
  resolver: {
    Query: {
      workoutVideo: {
        description: 'Gets a single video and gets its VdoCipher access',
        resolverOf: 'application::workout-video.workout-video.findOne',
        resolver: async (_obj, options, { context }) => {
          context.request.body = _.toPlainObject(options)

          const sanitizedVideo = await strapi.controllers['workout-video'].findOne(context)

          if (sanitizedVideo) {
            // get VDOCipher video
            const vdoCipherResponse = await fetch(
              `https://dev.vdocipher.com/api/videos/${sanitizedVideo.code}/otp`,
              {
                body: JSON.stringify({ ttl: 300 }),
                method: 'POST',
                headers: {
                  Authorization: `Apisecret ${process.env.VDOCIPHER_API_KEY}`,
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                },
              }
            ).then((response) => response.json())

            sanitizedVideo.otp = vdoCipherResponse.otp
            sanitizedVideo.playbackInfo = vdoCipherResponse.playbackInfo
          }
          return sanitizedVideo
        },
      },
    },
    Mutation: {},
  },
}
