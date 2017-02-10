var parser = require('url').parse

/**
 * Extends request object by parsing url into constituent parts
 * and adding to object as attributes.
 *
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 *
 */
module.exports = function (req, res) {
    var parsed = {}

    if (req.url) {
        parsed = parser(req.url, true)
    }

    req.path = parsed.pathname.toLowerCase() || '/'
    req.query = parsed.query || {}
}