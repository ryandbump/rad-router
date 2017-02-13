var send = require('./send')

/**
 * Extends response object with send function
 *
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 *
 */
module.exports = function (req, res) {
    res.send = send
}