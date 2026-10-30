const { handleRequest } = require("./_lib");

module.exports = handleRequest;
module.exports.config = { api: { bodyParser: false } };
