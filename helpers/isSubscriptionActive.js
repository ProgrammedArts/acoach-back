module.exports = function isSubscriptionActive(user) {
  if (user && user.subscription) {
    return (
      user.subscriptionActive && new Date(user.subscriptionEnd).getTime() > new Date().getTime()
    )
  }
  return false
}
