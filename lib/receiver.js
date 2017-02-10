/**
 * Function for generic error response
 *
 * @param {object} error
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 *
 */
module.exports = function (error, req, res) {
    if (res.headersSent) {
        return
    }

    if (error) {
        res.statusCode = error.status || 500
        res.end(error.toString())
        return
    }

    res.statusCode = 404
    res.end("Not Found")
}