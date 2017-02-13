/**
 * Function for generic not found response
 *
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 *
 */
module.exports = function (req, res, status, message) {
    if (res.headersSent) {
        return
    }

    if (typeof status === 'string') {
        message = status
        status = undefined
    }

    message = message || "Not Found"

    res.statusCode = status || 404

    res.end(message)
}