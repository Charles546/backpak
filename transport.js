/***
 * Author: Charles Huang <huangc.cd@gmail.com>
 * Date: 2/28/2015
 * Project: backpak
 * 
 *   implement the transport mechanism for the api framework
 * 
 */

(function(backpak, inBrowser, undefined) {
    // wrapping function to provide name space and browser/node detection
    
    function nop(){}
    
    var _ = (inBrowser ? window._ : require('lodash'));
    var Promise = (inBrowser ? window.Promise : require('bluebird'));
    var events = (inBrowser ? {EventEmitter: window.EventEmitter} : require('events'));
    var ws = (inBrowser ? nop : require('ws'));
    var net = (inBrowser ? {Socket: nop} : require('net'));
    var chunked = (inBrowser ? backpak.chunked : require('./chunkedTransport.js'));
    var enc = (inBrowser ? backpak.encryption : require('./encryption.js'));
    
    var _re = /([^;].*?[^\\]);;;/g;
    
    function connection(handler, c) {
        events.EventEmitter.call(this);
        var conn = this;
        conn.handler = handler;
        conn.raw = c;
        
        conn.on('message', conn._onMessage.bind(conn));
        conn.on('error', conn._onError.bind(conn));
    
        c.on('err', conn.emit.bind(conn, 'error'));
        c.on('error', conn.emit.bind(conn, 'error'));
    
        if (c instanceof net.Socket)
            c.on('data', conn._onData.bind(conn));
        else if (c instanceof ws || c instanceof chunked.Connection)
            c.on('message', conn.emit.bind(conn, 'message'));
    }
    
    connection.prototype = Object.create(events.EventEmitter.prototype);
    connection.prototype.constructor = connection;
    
    _.merge(connection.prototype, {
        _onData: function(buf) {
            this.chunk = (this.chunk || '') + buf.toString();
            var next = 0;
            var match =  _re.exec(this.chunk);
            if (match) {
                while (match) {
                    next = match.index + match[1].length + 3;
                    this.emit('message', match[1]);
                    match =  _re.exec(this.chunk);
                }
            }
            this.chunk = this.chunk.slice(next);
        },
        _onError: function(e) {
            if (this.raw instanceof ws) {
                this.raw.terminate();
                delete this.raw;
            } else if (this.raw instanceof net.Socket) {
                this.raw.end();
                this.raw.destroy();
                this.raw.unref();
                delete this.raw;
            } else if (this.raw instanceof chunked.Connection) {
                this.raw.end();
                delete this.raw;
            }
            this.emit('error', e);
        },
        _onRPCError: function(context, e) {
            this.handler.logger.warn('RPC error: ' + e.message + '\n' + e.stack);
            if (context.reply) {
                context.reply.error = e.message;
                this.send(context.reply, context.transaction);
            }
            this.emit('rpcerror', e);
        },
        _onMessage: function(msgStr, transaction) {
            this.handler.logger.debug('Message assembled from received chunks: ' + msgStr);
            var conn = this;
            var context = {connection: conn, transaction: transaction};
    
            try {
                var msg = JSON.parse(msgStr);
                if (this.handler.cfg.useEncryption)
                    enc.decrypt(msg, context);

                Promise.resolve(msg.payload)
                .then(function(p) {
                    msg.payload = p;
                    if (conn.handler.cfg.useSignature)
                        return enc.verifyPayload(msg, context);
                })
                .then(function() {
                    enc.tokenizeIncoming(msg, context);
                    return conn.handler.dispatch(msg.payload, context);
                })
                .then(function(result) {
                    enc.tokenizeOutgoing(msg, context);
                    if (context && context.reply) {
                        context.reply.msg = result;
    
                        return conn.send(context.reply, transaction);
                    }
                })
                .catch(this._onRPCError.bind(this, context));
            } catch(e) {
                this._onRPCError(context, e);
            }
        },
        send: function(payload, transaction) {
            try {
                this.handler.logger.debug('Sending message: ' + JSON.stringify(payload));
                var conn = this;
                var context = {connection: conn, transaction: transaction};
                var msg = {payload: payload};
        
                Promise.resolve(conn.handler.cfg.useSignature && enc.makeSignature(msg, context))
                .then(function() {
                    return conn.handler.cfg.useEncryption && enc.encrypt(msg, context);
                })
                .then(function() {
                    if (conn.raw instanceof net.Socket)
                        return conn.raw.write(JSON.stringify(msg) + ';;;');
                    else if (conn.raw instanceof ws)
                        return conn.raw.send(JSON.stringify(msg));
                    else if (conn.raw instanceof chunked.Connection)
                        return conn.raw.send(JSON.stringify(msg), transaction);
                })
                .catch(function(e) {
                    conn.emit('error', e);
                });
            } catch(e) {
                this.emit('error', e);
            }
        },
    });
    
    function transport(handler) {
        events.EventEmitter.call(this);
        this.handler = handler;
        this.on('connection', this._onConnect.bind(this));
        this.ready = this.listen();
    }
    
    transport.prototype = Object.create(events.EventEmitter.prototype);
    transport.prototype.constructor = transport;
    
    _.merge(transport.prototype, {
        _onConnect: function(c) {
            this.logger.info('New incoming connection from: ' + (c.remoteAddress || c._socket.remoteAddress));
            return new connection(this.handler, c);
        },
        listen: function() {
            var svr = this.handler;
            svr.listeners = svr.listeners || [];
            if (svr.cfg.transport.socket) {
                var listener = net.createServer(this.emit.bind(this, 'connection'));
                listener.on('error', svr.emit.bind(svr, 'error'));
                listener.listen(svr.cfg.service.transport.port || 8123, svr.cfg.transport.socket.host || '0.0.0.0');
                svr.listeners.push(listener);
            }
            if (svr.cfg.transport.ws) {
                var wss = new ws.Server(svr.cfg.transport.ws);
                wss.on('error', svr.emit.bind(svr, 'error'));
                wss.on('connection', this.emit.bind(this, 'connection'));
                svr.listeners.push(wss);
            }
            if (svr.cfg.transport.chunked) {
                var chunked = new chunked.Server(svr.cfg.transport.chunked);
                chunked.on('error', svr.emit.bind(svr, 'error'));
                chunked.on('connection', this.emit.bind(this, 'connection'));
                svr.listeners.push(chunked);
            }
        },
        end: function(exitCode) {
            _.forEach(this.handler.listeners, function(listener) {
                if (listener instanceof net.Socket) {
                    listener.end();
                    listener.destroy();
                } else if (listener instanceof ws) {
                    listener.terminate();
                } else if (listener instanceof chunked) {
                    listener.end();
                }
            });
        }
    });
    
    if (inBrowser) {
        backpak.transport = transport;
        backpak.transport.Connection = connection;
    } else {
        module.exports = transport;
        module.exports.Connection = connection;
    }
})(module ? {} : (window.backpak = (window.backpak || {})), module ? false : true);
