const ROOT = 'root'
const STATIC = 'static'
const PARAM = 'param'
const WILDCARD = 'wildcard'
const GROUP = 'group'


/**
 * Constructor for a node element in the radix tree structure
 *
 * @param {string} path         | optional
 * @param {boolean} varChild    | optional
 * @param {nodeType} string     | optional
 * @param {number} maxVars      | optional
 * @param {string} childKeys    | optional
 * @param {array} children      | optional
 * @param {function} handler    | optional
 * @param {number} priority     | optional
 * @param {array} middleware    | optional
 *
 */
function Node(path = '', varChild = false, nodeType = STATIC, maxVars = 0, childKeys = '', children = [], handler = null, priority = 1, middleware = []) {
    // path of node
    this.path = path

    // reflects if node has a variable node (param or wildcare) as a child
    this.varChild = varChild

    // used to identify rules for dealing with node when encountered on traversal
    this.nodeType = nodeType

    // indicates maximum number of variables in longest child branch
    this.maxVars = maxVars

    // first letter of each child node's path used for tree navigation
    this.childKeys = childKeys

    // array of children nodes
    this.children = children

    // function used for execution in path matches
    this.handler = handler

    // priority level is the number of children under a node
    // used to ensure that the most likely child with a matching path is checked first
    this.priority = priority

    // array of functions defined as middleware
    // added to execution stack as node is traversed on the way to destination node
    this.middleware = middleware
}


/**
 * Function adds a new route node to the radix tree.
 *
 * @param {string} path
 * @param {function} handler
 * @param {boolean} group       | optional
 *
 */
Node.prototype.addRoute = function (path, handler, group = false) {
    // Copy over this so it can be reassigned during traverse loop
    var _this = this

    // lowercase all paths to remove case sensitivity
    path = path.toLowerCase()

    // increment current nodes priority
    _this.priority++

    // count number of variables in route
    var numVars = pathVariables(path)

    //Check for non-empty Tree
    if (_this.path.length > 0 || _this.children.length > 0) {

        // main traversal loop
        // using label to ensure step to top of loop is always available
        traverse: while (true) {
            if (numVars > _this.maxVars) _this.maxVars = numVars

            var i = 0
            var max = Math.min(path.length, _this.path.length)

            // find position where current nodes path and new nodes path stop matching
            while (i < max && path[i] === _this.path[i]) {
                i++
            }

            // if match ends in the middle of current nodes path split node
            // split happens at the position where match ends (i)
            // creates a child of current node containing all of current nodes data
            // path of child is the non-matching portion of current node's path
            if (i < _this.path.length) {
                var child = new Node(
                    _this.path.substr(i),
                    _this.varChild,
                    _this.nodeType,
                    _this.maxVars,
                    _this.childKeys,
                    _this.children,
                    _this.handler,
                    _this.priority - 1
                )

                // reset maxVars to max of children
                child.children.forEach((subchild) => {
                    if (subchild.maxVars > child.maxVars) {
                        child.maxVars = subchild.maxVars
                    }
                })

                // reset current nodes information
                // path will be the matching portion of current node's path
                // childKeys will just be first character of newly created child
                _this.children = [child]
                _this.childKeys = _this.path[i]
                _this.path = path.substr(0, i)
                _this.handler = null
                _this.varChild = false
                _this.nodeType = STATIC
            }

            // add node as a child of current node
            // this implies path matches the path of current node completely and
            // still has left over path that needs to be put into child node
            if (i < path.length) {

                // if current node is a group node then no node can be made a child of this node
                if (_this.nodeType == GROUP) {
                    throw new Error("Can not add path as child of defined group")
                }

                // cutoff path portion that is handled by current node
                path = path.slice(i)

                // if current node has a variable child check to make sure new path has matching variable name
                // can not have two different variables defined in same portion of path
                if (_this.varChild) {

                    _this = _this.children[0]
                    _this.priority++

                    if (numVars > _this.numVars) {
                        _this.numVars = numVars
                    }
                    numVars--

                    if (_this.path == path.substr(0, _this.path.length) && (_this.path.length == path.length || path[_this.path.length] == '/')) {
                        continue traverse
                    } else {
                        throw new Error(`Path has an invalid wildcard value: ${path.split('/')[0]}`)
                    }
                }

                var char = path[0]

                // Check for slash after param, step down tree if slash
                if (_this.nodeType == PARAM && char == '/' && _this.children.length == 1) {
                    _this = _this.children[0]
                    _this.priority++
                    continue traverse
                }

                // check if child with next path portion exists
                // done by walking through childKeys and visiting the matching child
                for (var i = 0; i < _this.childKeys.length; i++) {
                    if (char == _this.childKeys[i]) {

                        // once a matching indice is found need to add to the current nodes priority
                        // also reordering children based on new priority
                        i = _this.reprioritize(i)
                        _this = _this.children[i]
                        continue traverse
                    }
                }

                // otherwise add node as child
                // start by adding default child node and then calling addChild
                // addChild will check for variables if none exist it will set path and handler as is
                if (char != ':' && char != '*') {
                    _this.childKeys += char

                    var child = new Node(
                        '',
                        false,
                        group ? GROUP : STATIC,
                        numVars,
                        '',
                        [],
                        null,
                        0
                    )

                    _this.children.push(child)
                    _this.reprioritize(_this.childKeys.length - 1)
                    _this = child
                }

                _this.addChild(numVars, path, handler, group)

                return

              // if the new path and current node's path are equal then check for existence of handler
              // if no handler exists then assign handler to node otherwise error
            } else if (i == path.length) {

                if (_this.handler != null) {
                    throw new Error(`A handler is already registered for path`)
                }

                _this.handler = handler
            }

            return
        }

    } else {
        // empty tree, just insert child
        _this.addChild(numVars, path, handler, group)
        _this.nodeType = group ? GROUP : ROOT
    }
}


/**
 * Function adds a child to the current node to expand the radix tree.
 *
 * @param {number} numVars
 * @param {string} path
 * @param {function} handler
 *
 */
Node.prototype.addChild = function (numVars, path, handler) {

    // copy this to allow reassignment in traverse loop
    var _this = this

    var offset = 0
    var max = path.length

    // if path contains any variables find them all and build tree accordingly
    for (var i = 0; numVars > 0; i++) {

        var char = path[i]

        // trying to find beginning position of each variable
        // do not care about other characters
        if (char != ':' && char != '*') {
            continue
        }

        // trying to find end of variable name
        // step to first character of name and loop through until end of path or / is found
        var end = i + 1
        while (end < max && path[end] != '/') {
            if (path[end] == ':' || path[end] == '*') {
                throw new Error(`only one variable allowed per path segment`)
            } else {
                end++
            }
        }

        // can not set a variable as child of node with existing children
        if (_this.children.length > 0) {
            throw new Error(`variable route conflicts with existing children in path`)
        }

        // check for name, all variables must have names
        if (end - i < 2) {
            throw new Error(`variables must be named in path`)
        }

        // variable type is param
        if (char == ':') {

            // if path doesn't start with variable then set current node's path
            // to be portion of path before variable
            if (i > 0) {
                _this.path = path.substr(offset, i)
                offset = i
            }

            var child = new Node(
                '',
                false,
                PARAM,
                numVars,
                '',
                [],
                null,
                0
            )
            _this.children = [child]
            _this.varChild = true
            _this = child
            _this.priority++

            // reduce variable counter as one variable has been dealt with
            numVars--

            // if the end of the variable name is not the end of the path then
            // another node needs to be added as a child to the variable node
            // otherwise continue to bottom and assign path and handler
            if (end < max) {
                _this.path = path.substr(offset, end)
                offset = end

                child = new Node(
                    '',
                    false,
                    group ? GROUP : STATIC,
                    numVars,
                    '',
                    [],
                    null,
                    1
                )

                _this.children = [child]
                _this = child
            }

        } else {
            //variable type is wildcard

            // can not have any path or variables after a wildcard
            if (end != max || numVars > 1) {
                throw new Error(`wildcard routes can only be at the end of the path`)
            }

            // can not assign a wildcard over an existing route
            if (_this.path.length > 0 && _this.path[_this.path.length - 1] == '/') {
                throw new Error(`wildcard conflicts with existing handle for the path segment`)
            }

            // step back to / before wildcard
            i--
            if (path[i] != '/') {
                throw new Error(`No '/' before wildcard in path`)
            }

            // set current nodes path to everything before the /*wildcard
            _this.path = path.substr(offset, i)

            // wildcard node with empty path
            // this ensures the traversal loop for retrieving values from node passes
            // correct conditional regardless of wildcard variable content
            //
            // requried conditonal to pass: (path.length > _this.path,length)
            // in function buildStack()
            var child = new Node(
                '',
                true,
                WILDCARD,
                1,
                '',
                [],
                null,
                0
            )
            _this.children = [child]
            _this.childKeys = path[i]
            _this = child
            _this.priority++

            // wildcard node with variable value set as child of empty path node
            child = new Node(
                path.substr(i),
                false,
                WILDCARD,
                1,
                '',
                [],
                handler,
                1
            )
            _this.children = [child]

            return
        }
    }

    // if path has no variables set path and handler
    _this.path = path.substr(offset)
    _this.handler = handler
}


/**
 * Function builds the execution stack for a route by navigating the radix tree.
 *
 * @param {string} path
 * @param {string} method           | only relevant to processing group nodes
 * @param {array} executionStack    | optional
 *
 */
Node.prototype.buildStack = function (path, method, executionStack = []) {

    // copy this to allow reassignment in traverse loop
    var _this = this

    // normalize path to lowercase
    path = path.toLowerCase()

    var params = {}
    var handler = null

    traverse: while (true) {

        // only two options, path is longer than current path or path matches current path

        // if path longer than current path then check for matching substring
        if (path.length > _this.path.length) {

            // if no matching substring return null handler
            if (path.substr(0, _this.path.length) == _this.path) {

                // trim path
                path = path.substr(_this.path.length)

                // if no variable child then find matching indice, step down to matching child and loop
                if (!_this.varChild) {

                    // special case: if group node then trimmed path needs to be passed into subrouter for handling
                    if (_this.nodeType == GROUP) {
                        return _this.handler.buildStack(path, method, executionStack.concat(_this.middleware))
                    }

                    // find matching indice
                    var char = path[0]
                    for (var i = 0; i < _this.childKeys.length; i++) {
                        if (char == _this.childKeys[i]) {

                            // if node is root or group then it can have middleware
                            // therefore need to add it to execution stack before stepping down to child
                            if (_this.nodeType == ROOT || _this.nodeType == GROUP) {
                                executionStack = executionStack.concat(_this.middleware)
                            }

                            _this = _this.children[i]
                            continue traverse
                        }
                    }

                    // if no matching indice but path matches current node except for trailing slash
                    // then use current nodes handler (essentially redirecting url w/o trailing slash)
                    if (path == '/' && _this.handler != null) {
                        handler = _this.handler
                    }

                    return {
                        params: params,
                        handler: handler,
                        stack: executionStack.concat(handler)
                    }
                }

                // see comment on 435
                if (_this.nodeType == ROOT || _this.nodeType == GROUP) {
                    executionStack = executionStack.concat(_this.middleware)
                }

                _this = _this.children[0]

                // node has a variable value to extract
                if (_this.nodeType == PARAM) {

                    var end = 0

                    // find ending index of value occupying the param segment of the path
                    while (end < path.length && path[end] != '/') {
                        end++
                    }

                    params[_this.path.substr(1)] = path.substr(0, end)


                    // if there is more path after dealing with variable then trim path, step down to child and loop
                    // variable nodes will only ever have one child '/'
                    if (end < path.length) {
                        if (_this.children.length > 0) {
                            path = path.substr(end)
                            _this = _this.children[0]
                            continue traverse
                        }

                        // check for a trailing slash, use current handler if it exists
                        if (path.length == end + 1) {
                            handler = _this.handler
                        }

                        return {
                            params: params,
                            handler: handler,
                            stack: executionStack.concat(handler)
                        }
                    }

                    // otherwise use current handler because path is complete
                    handler = _this.handler
                    if (handler != null) {

                        return {
                            params: params,
                            handler: handler,
                            stack: executionStack.concat(_this.middleware).concat(handler)
                        }

                    } else if (_this.children.length == 1) {
                        // check to see if handler is on node for the trailing slash
                        // use that handler if that is the case
                        _this = _this.children[0]
                        if (_this.path == '/' && _this.handler != null) {
                            handler = _this.handler
                        }
                    }

                    return {
                        params: params,
                        handler: handler,
                        stack: executionStack.concat(handler)
                    }

                } else if (_this.nodeType == WILDCARD) {

                    // variable value is everything after /*
                    params[_this.path.substr(2)] = path

                    handler = _this.handler

                    return {
                        params: params,
                        handler: handler,
                        stack: executionStack.concat(_this.middleware).concat(handler)
                    }

                } else {
                    throw new Error("Invalid node type")
                }
            }

          // path's match exactly
        } else if (path == _this.path) {

            // if node is type group then add a slash, otherwise an empty string will be passed into subrouter
            if (_this.nodeType == GROUP) {
                return _this.handler.buildStack('/', method, executionStack)
            }

            handler = _this.handler
            if (handler != null) {

                return {
                    params: params,
                    handler: handler,
                    stack: executionStack.concat(_this.middleware).concat(handler)
                }
            }

            // redirecting to a trailing slash version of path
            // only redirects if there exists a child node with / as the path
            // or if there is a wildcard node that can be accessed by adding a trailing slash
            for (var i = 0; i < _this.childKeys.length; i++) {
                if (_this.childKeys[i] == '/') {
                    _this = _this.children[i]
                    if ((_this.path.length == 1 && _this.handler != null) ||
                        (_this.nodeType == WILDCARD && _this.children[0].handler != null)) {
                            handler = _this.handler || _this.children[0].handler
                    }

                    return {
                        params: params,
                        handler: handler,
                        stack: executionStack.concat(handler)
                    }
                }
            }

            return {
                params: params,
                handler: handler,
                stack: executionStack.concat(handler)
            }
        }



        // if left over path is a slash or if paths match except for a trailing slash then use current handler
        if ((path == '/') || (_this.path.length == path.length + 1 && _this.path[path.length] == '/' && path == _this.path.substr(0, _this.path.length - 1) && _this.handler != null)) {
            handler = _this.handler
        }

        return {
            params: params,
            handler: handler,
            stack: executionStack.concat(handler)
        }
    }
}

/**
 * Function takes the index of a child node, updates its priority and reorders children and childKeys
 *
 * @param {number} index
 * @return {number}
 */
Node.prototype.reprioritize = function (index) {
    var child = this.children[index]
    child.priority++

    this.children.sort(function (a, b) {
        return a.priority < b.priority
    })

    var newIndex = index
    for (var i = 0; i < this.children.length; i++) {
        if (this.children[i].path == child.path) {
            newIndex = i
            break
        }
    }

    // rebuild childKeys string: characters before new position + repositioned indice + characters from new position to old position + remaining characters
    if (newIndex != index) {
        this.childKeys = this.childKeys.substr(0, newIndex) +
            this.childKeys.substr(index, index + 1) +
            this.childKeys.substr(newIndex, index) +
            this.childKeys.substr(index + 1)
    }

    return newIndex
}

/**
 * Counts the number of variables in a path
 *
 * @param {string} path
 * @return {number}
 */
function pathVariables(path) {
    var numVars = 0

    for (var i = 0; i < path.length; i++) {
        if (path[i] !== ':' && path[i] !== '*') continue

        numVars++
    }

    return numVars
}


module.exports = Node