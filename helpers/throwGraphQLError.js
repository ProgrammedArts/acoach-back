const checkBadRequest = require('./checkBadRequest')

module.exports = function throwGraphQLError(id, message, context) {
  context.badRequest(null, [{ messages: [{ id, message }] }])
  checkBadRequest(context.body.toJSON ? context.body.toJSON() : context.body)
}
