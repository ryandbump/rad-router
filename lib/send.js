/**
 * Generic function used to extend response object for typical response.
 *
 * @param {number} status
 * @param {string|object} data
 *
 */
module.exports = function (status, data) {
    var type

    if (typeof status !== 'number') {
        data = status
        status = undefined
    }


    if (typeof data === 'object') {
        type = 'application/json'
        data = JSON.stringify(data)
    } else if (typeof data === 'string') {
        type = 'text/html'
    }

    this.statusCode = status || 200
    this.setHeader('Content-Type', type)
    this.end(data)
}