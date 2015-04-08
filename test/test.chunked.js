/***
 * Author: Charles Huang <huangc.cd@gmail.com>
 * Date: 4/7/2015
 * Project: backpak
 * 
 *   test the encryption/decryption of the backpak framework
 * 
 */

// var Promise = require('bluebird');
var assert = require('assert');
var _ = require('lodash');
var http = require('http');
function nop() {}

// namespace wrapping
(function(describe, it, before, after) {
    var chunked;
    var server;
    var cfg;
    var req;
    describe("chunked transport", function() {
        before(function(done) {
            cfg = require('../defaultCfg').transport.chunked;
            chunked = require('../chunkedTransport');
            done();
        });
        
        /*describe("server", function() {
            it("listen", function(done) {
                server = new chunked(cfg);
                done();
            });
            it("accept connection", function(done) {
                req = http.request({
                    hostname: '127.0.0.1',
                    port: cfg.port,
                    path: '/_events',
                    method: 'POST',
                }, function(incoming) {
                    assert.equal(Object.keys(server.connections).length, 1);
                    assert(incoming.headers["set-cookie"][0].slice(4).split(';')[0] in server.connections, 'cid in collection');
                    done();
                }).end();
            });
            it("emit connection event", function(done) {
                server.on('connection', function(c) {
                    assert.equal(c.isServer, true);
                    done();
                });
                req = http.request({
                    hostname: '127.0.0.1',
                    port: cfg.port,
                    path: '/_events',
                    method: 'POST',
                }).end();
            });
            it("graceful shutdown", function(done) {
                server.end();
                setTimeout(done, 100);
            });
        });
        
        describe('server connection', function() {
            before(function(done) {
                server = new chunked(cfg);
                done();
            });
            
            var cid;
            it("initialize", function(done) {
                req = http.request({
                    hostname: '127.0.0.1',
                    port: cfg.port,
                    path: '/_events',
                    method: 'POST',
                }, function(incoming) {
                    cid = incoming.headers["set-cookie"][0].slice(4).split(';')[0];
                    assert.equal(server.connections[cid].cid, cid);
                    assert.equal(server.connections[cid].isServer, true);
                    done();
                });
                req.on('response', function(incoming) {
                    req.socket = incoming.socket;
                });
                req.end();
            });
            
            var req2;
            it("create transactions", function(done) {
                req2 = http.request({
                    hostname: '127.0.0.1',
                    port: cfg.port,
                    path: '/_api',
                    method: 'POST',
                    headers: {cookie: ["cid=" + cid]},
                });
                req2.write('hello');
                setTimeout(function() {
                    assert.equal(server.connections[cid].transactions.length, 1);
                    assert.equal(server.connections[cid].transactions[0].inBuf, 'hello');
                    done();
                }, 20);
            });
            
            it("emits message", function(done) {
                req2.end(' world');
                server.connections[cid].on('message', function(msg) {
                    assert.equal(msg, 'hello world');
                    done();
                });
            });
            
            it("ends transaction", function(done) {
                req2.on('response', function(incoming) {
                    var buf = '';
                    incoming.on('data', function(data) {
                        buf += data;
                    });
                    incoming.on('end', function() {
                        assert.equal(server.connections[cid].transactions.length, 0);
                        assert.equal(buf, 'hi there');
                        done();
                    });
                });
                server.connections[cid].send('hi there', server.connections[cid].transactions[0]);
            });
            
            it("set timeout when lost event conneciton", function(done) {
                req.socket.end();
                req.socket.destroy();
                setTimeout(function() {
                    assert.notEqual(server.connections[cid].timeout, undefined);
                    done();
                }, 20);
            });
            
            after(function(done) {
                server.end();
                setTimeout(done, 10);
            });
        });*/

        describe("experiment", function() {
            it("listen", function(done) {
                server = new chunked(cfg);
                done();
            });
            it("accept connection", function(done) {
                req = http.request({
                    hostname: '127.0.0.1',
                    port: cfg.port,
                    path: '/_events',
                    method: 'POST',
                }, function(incoming) {
                    assert.equal(Object.keys(server.connections).length, 1);
                    var cid2 = incoming.headers["set-cookie"][0].slice(4).split(';')[0];
                    assert(cid2 in server.connections, 'cid in collection');

                    var buf = '';
                    incoming.on('data', function(d) {
                        d=d.toString();
                        console.log(d);
                        buf+=d;
                        console.log(buf);
                        if (buf ==='OKmy world;;;') {
                            req.write('again ');
                        }
                        if (d==='hahaha;;;') {
                            done();
                        }
                    });


                    server.connections[cid2].context.request.on('data', function(d) {
                        d = d.toString('utf-8');
                        console.log('server: ' + d);
                        console.log('"' + d + '"==="hello "');
                        if (d==='hello ') {
                            console.log('ok to send');
                            server.connections[cid2].send('my world');
                        }
                        else if (d==='again ')
                            server.connections[cid2].send('hahaha');
                        else
                            console.log('shoundn be here');
                    });
                });
                req.write('hello ');
            });
            /*it("emit connection event", function(done) {
                server.on('connection', function(c) {
                    assert.equal(c.isServer, true);
                    done();
                });
                req = http.request({
                    hostname: '127.0.0.1',
                    port: cfg.port,
                    path: '/_events',
                    method: 'POST',
                }).end();
            });
            it("graceful shutdown", function(done) {
                server.end();
                setTimeout(done, 100);
            });*/
        });
        
    });
    
})(describe, it, before, after);
