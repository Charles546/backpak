/***
 * Author: Charles Huang <huangc.cd@gmail.com>
 * Date: 3/24/2015
 * Project: backpak
 * 
 * This file implements a connection transport type through web chunked response
 * 
 */


(function(backpak, inBrowser, undefined) {
    // wrapping function to provide name space and browser/node detection
    
    function nop(){}
    

    var _ = (inBrowser ? window._ : require('lodash'));
    var events = (inBrowser ? {EventEmitter: window.EventEmitter} : require('events'));
    var http = (!inBrowser && require('http'));
    var XMLHttpRequest = (inBrowser && window.XMLHttpRequest);

    function connection(cid, context) {
        events.EventEmitter.call(this);
        this.cid = cid;
        this.context = context;
        this.isServer = context && context.response && true || false;
        var conn = this;

        if (this.isServer) {
            this.transactions = [];
            context.response.on('error', conn.endAtTimeout.bind(conn));
            context.response.on('close', conn.endAtTimeout.bind(conn));
        } else 
            this.xhrreconnect();
    }
    
    connection.prototype = Object.create(events.EventEmitter.prototype);
    connection.prototype.constructor = connection;

    _.merge(connection.prototype, {
        startTransaction: function(req, resp) {
            // assert this.isServer
            var transaction = { req: req, resp: resp, inBuf: '' };
            this.transactions.push(transaction);
            var conn = this;
            
            req.on('data', this._onreqdata.bind(this, transaction));
            req.on('end', this._onreqend.bind(this, transaction));
            resp.on('error', function(e) {
                conn.endTransaction(transaction);
                conn.emit('error', new Error('Web response failure'));
            });
            
            resp.writeHead(200);
            
            if (this.timeout)
                this.endAtTimeout();
        },
        _onreqdata: function(transaction, data) {
            if (transaction.inBuf.length===0) {
                if (data.slice(0,2)==='OK') {
                    data = data.slice(2);
                }
            }
            transaction.inBuf += data;
        },
        _onreqend: function(transaction) {
            this.emit('message', transaction.inBuf, transaction);
            transaction.inBuf = '';
        },
        endTransaction: function(transaction) {
            _.pull(this.transactions, transaction);
            transaction.resp.end();
        },
        send: function(data, transaction) {
            if (this.isServer) {
                if (transaction) {
                    transaction.resp.end(data, 'utf-8');
                    this.endTransaction(transaction);
                } else {
                    console.log('to send: ' + data);
                    this.context.response.write(data + ';;;', 'utf-8');
                }
            } else {
                var tr = new XMLHttpRequest();
                var conn = this;
                tr.onerror = tr.onabort = function() {
                    conn.emit('error', new Error('Failed to send transaction'));
                };
                tr.onload = function() {
                    conn.emit('message', tr.response);
                };
                tr.open('POST', this.context.server.cfg.transport.chunked.url + '/_api', true);
            }
        },
        endAtTimeout: function() {
            if (this.timeout) {
                clearTimeout(this.timeout);
            }
            this.timeout = setTimeout(this.endNow.bind(this), 24*60*60*1000);
        },
        endNow: function() {
            if (this.timeout)
                clearTimeout(this.timeout);
            _.forEach(this.trans, function(tr) {
                tr.resp.removeAllListeners('error');
                tr.resp.end();
                tr.req.removeAllListeners('data');
                tr.req.removeAllListeners('end');
                tr.req.socket.unref();
            });
            if (this.context.response) {
                this.context.response.removeAllListeners('error');
                this.context.response.end();
                this.context.request.socket.unref();
            }
            if (this.xhr) {
                this.xhr.onload = this.xhr.onerror = this.xhr.onabort = undefined;
                this.xhr.abort();
            }
            this.emit('disconnect', this.cid);
        },
        xhrreconnect: function() {
            if (this.xhr) {
                this.xhr.onload = this.xhr.onerror = this.xhr.onabort = undefined;
                delete this.xhr;
            }
            this.xhr = new XMLHttpRequest();
            this.xhr.onload = this.xhr.onerror = this.xhr.onabort = this.xhrreconnect.bind(this);
            this.xhr.open('POST', this.cfg.transport.chunked.url + '/_events', true);
            this.xhr.onprogress = this._onxhrprogress.bind(this);
            this.xhr.send();
        },
        _onxhrprogress: function() {
            //readyState: headers received 2, body received 3, done 4
            if (this.xhr.readyState != 2 && this.xhr.readyState != 3 && this.xhr.readyState != 4)
                return;
            if (this.xhr.readyState == 3 && this.xhr.status != 200)
                return;
            
            this.xhrnext = this.xhrnext || 0;
            var data = this.xhr.response.slice(this.xhrnext);
            if (!this.xhrnext && data.slice(0,2)==='OK')
                this.xhrnext = 2;
            if (this.xhr.response.length > this.xhrnext)
                this.emit('data', this.xhr.response.slice(this.xhrnext || 0));

            this.xhrnext = this.xhr.response.length;            
        }
    });

    function server(cfg) {
        events.EventEmitter.call(this);
        this.on('request', this._onrequest.bind(this));
        this.on('error', this.emit.bind(this, 'error'));
        this.on('disconnect', this._ondisconnect.bind(this));

        this.server = http.createServer(this.emit.bind(this, 'request'));
        this.server.listen(cfg.port);
        this.connections = {};
    }
    
    server.prototype = Object.create(events.EventEmitter.prototype);
    server.prototype.constructor = server;
    server.Connection = connection;

    _.merge(server.prototype, {
        _onrequest: function(req, resp) {
            var cid; 
            if (req.url==='/_events') {
                do {
                    cid = Math.floor(Math.random()*1e10).toString();
                } while(cid in this.connections);
                var context = { server: this, request: req, response: resp};
                var conn = new connection(cid, context);
                conn.on('disconnect', this.emit.bind(this, 'disconnect'));

                this.connections[cid] = conn;
                resp.writeHead(200, {
                    "Set-Cookie": "cid=" + cid,
                    "Transfer-Encodig": "chunked",
                });
                resp.write('OK');

                this.emit('connection', conn);
            } else if (req.url==='/_api') {
                _.all(req.headers, function(value, key) {
                    if (key.toLowerCase()==='cookie' && value.slice(0,4)==='cid=') {
                        cid = value.slice(4).split(';')[0];
                        return true;
                    }
                });
                if (cid in this.connections) {
                    this.connections[cid].startTransaction(req, resp);
                }
            }
            
        },
        _ondisconnect: function(cid) {
            delete this.conn[cid];
        },
        end: function() {
            this.server.close();
            _.forEach(this.connections, function(conn) {
                conn.removeAllListeners('disconnect');
                conn.endNow();
            });
        },
    });

    if (inBrowser) {
        backpak.chunked = server;
    } else {
        module.exports = server;
    }
})(module ? {} : (window.backpak = (window.backpak || {})), module ? false : true);
