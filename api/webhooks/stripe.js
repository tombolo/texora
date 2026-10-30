const { handleStripeWebhook } = require("../_lib");

module.exports = handleStripeWebhook;
module.exports.config = { api: { bodyParser: false } };
