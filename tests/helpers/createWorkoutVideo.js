const { build, fake } = require('test-data-bot')
const faker = require('faker')

const buildWorkoutVideo = build('WorkoutVideo').fields({
  title: fake(() => faker.name.title()),
  code: fake(() => faker.random.alphaNumeric(20)),
  subscription: null,
})

module.exports = async (overrides = {}, options = { save: true }) => {
  const workoutVideo = buildWorkoutVideo(overrides)

  if (options.save) {
    return await strapi.services['workout-video'].create(workoutVideo)
  }
  return Promise.resolve(workoutVideo)
}
