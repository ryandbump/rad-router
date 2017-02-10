# Rad Router

A node http router using only the built in libraries. Uses a [Radix tree](https://en.wikipedia.org/wiki/Radix_tree) structure to organize its routes.

## Features

**No Tears From Trailing Slashes**: Automatically finds a route that would match if the given url either had or didn't have a trailing slash.

**Route Parameters**: You can include a named parameter in your route definition and access it as part of the request object in your route handler.

**Sub-Routers**: Assign a sub-router to handle all routes with a common prefix.

**Middleware**: Add middleware on a router by router basis. Allows specific middleware for a group of routes. All middleware in path to matching node will be added to stack for execution.

**Static Files**: Easily set up path for serving static files.

**Branch Priority**: Nodes keep track of the number of children nodes under them by assigning a priority. Higher priority paths will be tested first to limit extraneous testing of children.


## Example

``` js
var http = require('http')
var Router = require('rad-router')

const PORT = 3000

var router = new Router()

// basic middleware for top level router
router.use(function (req, res, next) {
    // peform middleware action
    next()
})

// route { method: 'GET', path: '/'}
router.get('/', function (req, res, next) {
    // perform action for '/' route

    // url queries can be accessed by:
    var query = req.query

    res.send(200, 'route: /')
})

router.get('/test/:id', function(req, res, next) {
    // perform action for '/test/:id' route

    // parameter id can be accessed by:
    var id = req.params.id

    res.send(200, 'route: /test/:id')
})



// basic sub-router
// this sub router will be assigned to the /api prefix
var apiRouter = new Router()

apiRouter.use(function(req, res, next) {
    // perform api middleware actions
    next()
})

// route { method: 'GET', path: '/api/'}
apiRouter.get('/', function(req, res, next) {
    // perform action for '/api/' route
    res.send(200, 'route: /api/')
})



// assign subrouter to a group
router.group('/api', apiRouter)

// set up static file route
// static paths have to end in /*filepath
router.static('/assets/*filepath')


// wrap serve to ensure context of `this` is maintained
http.createServer(function (req, res, next) {
    router.serve(req, res, next)
})

http.listen(PORT, function () {
    console.log(`listening on port: ${PORT}`)
})
```

## Structure

In a [Radix tree](https://en.wikipedia.org/wiki/Radix_tree) every child of a parent shares a common path up until the end of the parent node's path.

```
Path                    Priority
/                           8
├ a                         4
| ├ bout-us/                1
| └ ssets                   2
|       └ /*filepath        1
├ blog                      3
|    └ /:post               2
|           └ /edit         1
└ contact                   1
```

Each node has a string called childKeys, this string is composed of the first letter of each child's path. These are kept in descending priority order and are used to quickly find the correct child node.

