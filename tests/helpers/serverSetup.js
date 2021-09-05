module.exports = async () => {
  // setup user permissions
  await strapi.plugins['users-permissions'].services.userspermissions.updatePermissions()

  // authenticated users can create subscriptions (necessary for checkout)
  const [subscriptionCreatePermission] = await strapi
    .query('permission', 'users-permissions')
    .find({
      type: 'application',
      controller: 'subscription',
      action: 'create',
      role: 1,
    })
  await strapi
    .query('permission', 'users-permissions')
    .update({ id: subscriptionCreatePermission.id }, { enabled: true })

  // anonymous users can browse subscriptions
  const [subscriptionFindPermission] = await strapi.query('permission', 'users-permissions').find({
    type: 'application',
    controller: 'subscription',
    action: 'find',
    role: 2,
  })
  await strapi
    .query('permission', 'users-permissions')
    .update({ id: subscriptionFindPermission.id }, { enabled: true })

  // authenticated users can browse workout-videos
  const [workoutVideoFindPermission] = await strapi.query('permission', 'users-permissions').find({
    type: 'application',
    controller: 'workout-video',
    action: 'find',
    role: 1,
  })
  await strapi
    .query('permission', 'users-permissions')
    .update({ id: workoutVideoFindPermission.id }, { enabled: true })
  const [workoutVideoFindOnePermission] = await strapi
    .query('permission', 'users-permissions')
    .find({
      type: 'application',
      controller: 'workout-video',
      action: 'findone',
      role: 1,
    })
  await strapi
    .query('permission', 'users-permissions')
    .update({ id: workoutVideoFindOnePermission.id }, { enabled: true })

  // anonymous users can request the confirmation email
  const [sendEmailConfirmationPermission] = await strapi
    .query('permission', 'users-permissions')
    .find({
      type: 'users-permissions',
      controller: 'auth',
      action: 'sendemailconfirmation',
      role: 2,
    })
  await strapi
    .query('permission', 'users-permissions')
    .update({ id: sendEmailConfirmationPermission.id }, { enabled: true })

  // authenticated users can do authenticated users mutations (change password)
  const [authenticatedPermission] = await strapi.query('permission', 'users-permissions').find({
    type: 'application',
    controller: 'authenticated',
    action: 'isauthenticated',
    role: 1,
  })
  await strapi
    .query('permission', 'users-permissions')
    .update({ id: authenticatedPermission.id }, { enabled: true })
}
