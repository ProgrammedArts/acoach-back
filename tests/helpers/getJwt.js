module.exports = (userId) =>
  strapi.plugins['users-permissions'].services.jwt.issue({
    id: userId,
  })
