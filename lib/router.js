var request = require('./request')
var response = require('./response')
var notFound = require('./notfound')
var serveStatic = require('./static')
var Node = require('./node')


/**
 * REST Http Verbs
 */
const METHODS = [
    'GET',
    'HEAD',
    'OPTIONS',
    'POST',
    'PUT',
    'PATCH',
    'DELETE'
]

/**
 * Router constructor
 */
function Router() {
    this.trees = {}
}

/**
 * General use function for adding routes to router
 *
 * @param {string} method
 * @param {string} path
 * @param {function} handler
 * @param {boolean} group       | optional
 *
 */
Router.prototype.handle = function (method, path, handler, group = false) {
    if (path[0] != '/') {
        throw new Error('Path must begin with /')
    }

    if (typeof handler !== 'function' && typeof handler !== 'object') {
        throw new Error('Must pass handler for route')
    }

    var root = this.trees[method]

    if (typeof root == 'undefined') {
        root = new Node()
        this.trees[method] = root
    }

    root.addRoute(path, handler, group)
}

/**
 * Defining function for each REST method.
 *
 * handler must be of format:
 *
 * function (req, res, next) {
 *   // do stuff
 * }
 *
 * @param {string} path
 * @param {function} handler
 *
 */
METHODS.forEach(function (method) {
    Router.prototype[method.toLowerCase()] = function (path, handler) {
        this.handle(method, path, handler)
    }
})


/**
 * Function for defining a group.
 *
 * A group is a collection of routes that share a common prefix.
 * Must pass a router to handle all routes in group.
 *
 * @param {string} method       | optional
 * @param {string} prefix
 * @param {Router} router
 *
 */
Router.prototype.group = function (method, prefix, router) {
    if (method[0] == '/') {
        router = prefix
        prefix = method
        method = '*'
    }

    if (typeof method == 'function') {
        throw new Error('Must provide prefix and router for a group')
    }

    if (typeof router != 'object') {
        throw new Error('Must provide a router to handle routes for the group')
    }

    if (method == '*') {
        METHODS.forEach(function (method) {
            if (router.trees[method]) {
                this.handle(method, prefix, router.trees[method], true)
            }
        }, this)
    } else {
        this.handle(method, prefix, router, true)
    }
}


/**
 * The function use is for defining middleware on a router.
 * All middleware is applied to the root node of the router.
 *
 * If you want specific middleware for a route or routes create
 * a group and add middleware to the sub-router.
 *
 * middleware function format:
 * function (req, res, next) {
 *      // do stuff
 *      next()
 * }
 *
 * @param {string} method
 * @param {function} middleware
 *
 */
Router.prototype.use = function (method, middleware) {

    if (typeof method == 'function') {
        middleware = method
        method = '*'
    }

    if (!METHODS.includes(method) && method != '*') {
        throw new Error("method must be one of the 7 REST methods or *")
    }
    if (!middleware) {
        throw new Error("function requried to define middleware")
    }

    // attach middlware to root
    if (method == '*') {
        //Attach to all trees, create root node if not exists
        METHODS.forEach(function (method) {
            addMiddleware(method, middleware, this)
        })
    } else {
        addMiddleware(method, middleware, this)
    }


}


/**
 * Function sets up a catch all route for serving static files.
 *
 * Path needs to be of the format: /path/for/files/*filepath
 *
 * The variable filepath will be passed into the serveStatic function
 * and will get file defined by path in filepath variable.
 *
 * To change the default static file directory from /public change
 * directory variable definition in static.js
 *
 * @param {string} path
 *
 */
Router.prototype.static = function (path) {
    if (path.substr(path.length - 10) != '/*filepath') {
        throw new Error("Path for serving files must end in /*filepath")
    }

    this.get(path, function (req, res, next) {
        serveStatic(req, res, next)
    })
}


/**
 * Function performs the functions in the execution stack in order.
 *
 * Also defines function next() locally and passes it into middleware and handlers
 *
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 * @param {array} stack
 *
 */
Router.prototype.walkStack = function (req, res, stack) {

    next()

    function next() {
        // var layer = stack[index++]
        var layer = stack.shift()
        if (!layer) return

        layer(req, res, next)
    }
}


/**
 * Main entry point for router.
 * Serve function should be passed in as the callback for http.createServer()
 *
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 *
 */
Router.prototype.serve = function (req, res) {
    request(req, res)
    response(req, res)

    var root = this.trees[req.method]

    if (root) {
        var { params, handler, stack } = root.buildStack(req.path, req.method)
        req.params = params

        if (handler != null) {
            this.walkStack(req, res, stack)

        } else {
            notFound(req, res)
        }
    }

    return
}

/**
 * Utility function for adding middleware to router.
 *
 * @param {string} method
 * @param {function} middleware
 * @param {this} _this
 *
 */
function addMiddleware(method, middleware, _this) {
    var node = _this.trees[method]

    if (typeof node == 'undefined') {
        node = new Node()
        _this.trees[method] = node
    }

    node.middleware = node.middleware.concat(middleware)
}


module.exports = Router