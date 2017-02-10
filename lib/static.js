var fs = require('fs')
var path = require('path')

const mimeTypes = require('./constants/mime')

var directory = '/full/path/to/static/files/here'
const STATIC_BASE_PATH = path.resolve(directory)

/**
 * Function finds file and streams content to response.
 *
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 *
 */
module.exports = function (req, res) {
    var filepath = req.params.filepath

    var fileLocation = path.join(STATIC_BASE_PATH, String(filepath))
    var extension = filepath.substr(filepath.lastIndexOf('.') + 1)

    var stream = fs.createReadStream(fileLocation)

    stream.on('error', function (error) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'text/plain')
        res.end("File Not Found")
    })

    res.setHeader('Content-Type', mimeTypes[extension])
    res.statusCode = 200
    stream.pipe(res)
}

