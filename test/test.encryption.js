/***
 * Author: Charles Huang <huangc.cd@gmail.com>
 * Date: 4/7/2015
 * Project: backpak
 * 
 *   test the encryption/decryption of the backpak framework
 * 
 */

var Promise = require('bluebird');
var assert = require('assert');
var _ = require('lodash');
function nop() {}

// namespace wrapping
(function(describe, it, before, after) {
    var enc;
    var svr;
    var clt;
    var conn1;
    var conn2;
    var msg1 = {payload: 'I am a test str.'};
    var reply1 = {payload: 'me too'};
    var encrypted;
    var clientConn;
    var serverConn;
    
    describe('backpak encryption', function(){
        before(function(done) {
            enc = require('../encryption');
            svr = {
                cfg: require('../defaultCfg'),
                getSecret: function(token) {
                    return 'lk3@#t';
                },
                logger: {
                    info: nop, // console.log,
                    warn: nop, // console.log,
                    error: nop, //console.log,
                    debug: nop, //console.log,
                },
            };
            conn1 = {
                handler: svr,
            };
            clt = {
                cfg: {
                    serverKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0N9gBsy9gm22/PRwQ0dG\na/D19N46tES/zsbeRKvxul0GANVtk1GGDhCOEUESv0kkdJdzoAEGxoR9Gdcxryj8\napjDSRnrhfv3CpOKQ0WtkgkiaVP2eZtcrLszb8yHVL6gfwze6jj4LzaT5yTmtV6e\naXT9zfB53QKxWsIn3AB5wq3/gxMwhWbY8huhuE/BWYO3jE7qeVtaPsJwmSATsLJV\nDXyR576919t325hf66Qslxx/dL9GPr5THKEmLmrGZbuHxerNmvTgZFJK23GJzW2E\nYkuLpWy4IBwNQo8dnrjk2jqF4m8Uw7R6xuUmpiRhH+YeIo1RH1lyFX0nz3qzYW6r\nYQIDAQAB\n-----END PUBLIC KEY-----',
                },
                logger: {
                    info: nop, // console.log,
                    warn: nop, // console.log,
                    error: nop, //console.log,
                    debug: nop, //console.log,
                },
            };
            conn2 = {
                handler: clt,
            };
            done();
        });

        describe('otp encryption', function() {
            it('encrypt with otp', function(done) {
                var msg = _.cloneDeep(msg1);
                var conn = _.cloneDeep(conn2);
                Promise.resolve(enc.encrypt(msg, {connection: conn}))
                .then(function() {
                    assert.equal(msg.payload, undefined);
                    assert.notEqual(msg.secpayload, msg.payload);
                    assert.notEqual(conn.otp, undefined);
                    assert.notEqual(conn.otp, msg.otp);
                    assert.equal(conn.secret, undefined);
                    encrypted = msg;
                    clientConn = conn;
                    done();
                })
                .catch(function(e) {
                    console.log(e.message, '\n', e.stack);
                    assert(false);
                    done();
                });
            });
    
            it('encrypt again yields different output', function(done) {
                var msg = _.cloneDeep(msg1);
                var conn = _.cloneDeep(conn2);
                Promise.resolve(enc.encrypt(msg, {connection: conn}))
                .then(function() {
                    assert.equal(msg.payload, undefined);
                    assert.notEqual(msg.secpayload, msg.payload);
                    assert.notEqual(msg.secpayload, encrypted.secpayload);
                    assert.notEqual(conn.otp, undefined);
                    assert.notEqual(conn.otp, msg.otp);
                    assert.notEqual(msg.otp, encrypted.otp);
                    assert.equal(conn.secret, undefined);
                    done();
                })
                .catch(function(e) {
                    console.log(e.message, '\n', e.stack);
                    assert(false);
                    done();
                });
            });
    
            it('decrypt with otp', function(done) {
                var msg = _.cloneDeep(encrypted);
                var conn = _.cloneDeep(conn1);
                Promise.resolve(enc.decrypt(msg, {connection: conn}))
                .then(function() {
                    assert.equal(msg.secpayload, undefined);
                    assert.equal(msg.payload, msg1.payload);
                    assert.equal(conn.otp, clientConn.otp);
                    serverConn = conn;
                    done();
                })
                .catch(function(e) {
                    console.log(e.message, '\n', e.stack);
                    assert(false);
                    done();
                });
            });
            
            it('reply with otp encryption', function(done) {
                var msg = _.cloneDeep(reply1);
                var conn = _.cloneDeep(serverConn);
                Promise.resolve(enc.encrypt(msg, {connection: conn}))
                .then(function() {
                    assert.equal(msg.payload, undefined);
                    assert.notEqual(msg.secpayload, undefined);
                    assert.notEqual(msg.secpayload, reply1.payload);
                    assert.equal(conn.otp, undefined);
                    assert.equal(msg.otp, undefined);
                    
                    return Promise.resolve(enc.decrypt(msg, {connection: clientConn}));
                })
                .then(function() {
                    assert.equal(msg.secpayload, undefined);
                    assert.equal(msg.payload, reply1.payload);
                })
                .then(function() {
                    assert.equal(serverConn.isMature, undefined);
                    assert.equal(clientConn.isMature, undefined);
                    done();
                })
                .catch(function(e) {
                    console.log(e.message, '\n', e.stack);
                    assert(false);
                    done();
                });
            });
        });
        describe('token secret encryption', function() {
            before(function(done) {
                delete clientConn.otp;
                clientConn.token = '123234135435325243';
                clientConn.secret = 'lk3@#t';
                
                delete serverConn.otp;
                done();
            });
            
            it('encrypt with token secret', function(done) {
                var msg = _.cloneDeep(msg1);
                var conn = _.cloneDeep(clientConn);
                Promise.resolve(enc.encrypt(msg, {connection: conn}))
                .then(function() {
                    assert.equal(msg.payload, undefined);
                    assert.notEqual(msg.secpayload, msg.payload);
                    assert.equal(conn.otp, undefined);
                    assert.equal(msg.otp, undefined);
                    assert.equal(msg.secret, undefined);
                    assert.equal(msg.token, clientConn.token);
                    assert.notEqual(msg.time, undefined);
                    encrypted = msg;
                    clientConn = conn;
                    done();
                })
                .catch(function(e) {
                    console.log(e.message, '\n', e.stack);
                    assert(false);
                    done();
                });
            });
    
            it('encrypt with token secret again yields different output', function(done) {
                var msg = _.cloneDeep(msg1);
                var conn = _.cloneDeep(clientConn);
                Promise.resolve(enc.encrypt(msg, {connection: conn}))
                .then(function() {
                    assert.equal(msg.payload, undefined);
                    assert.notEqual(msg.secpayload, msg.payload);
                    assert.equal(conn.otp, undefined);
                    assert.equal(msg.otp, undefined);
                    assert.equal(msg.secret, undefined);
                    assert.equal(msg.token, clientConn.token);
                    assert.notEqual(msg.time, undefined);
                    assert.notEqual(msg.time, encrypted.time);
                    assert.notEqual(msg.secpayload, encrypted.secpayload);
                    done();
                })
                .catch(function(e) {
                    console.log(e.message, '\n', e.stack);
                    assert(false);
                    done();
                });
            });

            it('decrypt with otp', function(done) {
                var msg = _.cloneDeep(encrypted);
                var conn = _.cloneDeep(serverConn);
                Promise.resolve(enc.decrypt(msg, {connection: conn}))
                .then(function() {
                    assert.equal(msg.secpayload, undefined);
                    assert.equal(msg.payload, msg1.payload);
                    assert.equal(conn.otp, undefined);
                    assert.equal(conn.token, clientConn.token);
                    serverConn = conn;
                    done();
                })
                .catch(function(e) {
                    console.log(e.message, '\n', e.stack);
                    assert(false);
                    done();
                });
            });
            
            it('reply with token secret encryption', function(done) {
                var msg = _.cloneDeep(reply1);
                var conn = _.cloneDeep(serverConn);
                Promise.resolve(enc.encrypt(msg, {connection: conn}))
                .then(function() {
                    assert.equal(msg.payload, undefined);
                    assert.notEqual(msg.secpayload, undefined);
                    assert.notEqual(msg.secpayload, reply1.payload);
                    assert.equal(conn.otp, undefined);
                    assert.equal(msg.otp, undefined);
                    
                    return Promise.resolve(enc.decrypt(msg, {connection: clientConn}));
                })
                .then(function() {
                    assert.equal(msg.secpayload, undefined);
                    assert.equal(msg.payload, reply1.payload);
                })
                .then(function() {
                    assert.equal(serverConn.isMature, true);
                    assert.equal(clientConn.isMature, true);
                    done();
                })
                .catch(function(e) {
                    console.log(e.message, '\n', e.stack);
                    assert(false);
                    done();
                });
            });
    
        });

        describe('matured connection encryption', function() {
            it('encrypt with token secret', function(done) {
                var msg = _.cloneDeep(msg1);
                var conn = _.cloneDeep(clientConn);
                Promise.resolve(enc.encrypt(msg, {connection: conn}))
                .then(function() {
                    assert.equal(msg.payload, undefined);
                    assert.notEqual(msg.secpayload, msg.payload);
                    assert.equal(conn.otp, undefined);
                    assert.equal(msg.otp, undefined);
                    assert.equal(msg.secret, undefined);
                    assert.equal(msg.token, undefined);
                    assert.notEqual(msg.time, undefined);
                    encrypted = msg;
                    clientConn = conn;
                    done();
                })
                .catch(function(e) {
                    console.log(e.message, '\n', e.stack);
                    assert(false);
                    done();
                });
            });
    
            it('encrypt again on matured connection yields different output', function(done) {
                var msg = _.cloneDeep(msg1);
                var conn = _.cloneDeep(clientConn);
                Promise.resolve(enc.encrypt(msg, {connection: conn}))
                .then(function() {
                    assert.equal(msg.payload, undefined);
                    assert.notEqual(msg.secpayload, msg.payload);
                    assert.equal(conn.otp, undefined);
                    assert.equal(msg.otp, undefined);
                    assert.equal(msg.secret, undefined);
                    assert.equal(msg.token, undefined);
                    assert.notEqual(msg.time, undefined);
                    assert.notEqual(msg.time, encrypted.time);
                    assert.notEqual(msg.secpayload, encrypted.secpayload);
                    done();
                })
                .catch(function(e) {
                    console.log(e.message, '\n', e.stack);
                    assert(false);
                    done();
                });
            });

            it('decrypt with matured connection', function(done) {
                var msg = _.cloneDeep(encrypted);
                var conn = _.cloneDeep(serverConn);
                Promise.resolve(enc.decrypt(msg, {connection: conn}))
                .then(function() {
                    assert.equal(msg.secpayload, undefined);
                    assert.equal(msg.payload, msg1.payload);
                    assert.equal(conn.otp, undefined);
                    assert.equal(conn.token, clientConn.token);
                    serverConn = conn;
                    done();
                })
                .catch(function(e) {
                    console.log(e.message, '\n', e.stack);
                    assert(false);
                    done();
                });
            });
            
            it('reply with matured connection encryption', function(done) {
                var msg = _.cloneDeep(reply1);
                var conn = _.cloneDeep(serverConn);
                Promise.resolve(enc.encrypt(msg, {connection: conn}))
                .then(function() {
                    assert.equal(msg.payload, undefined);
                    assert.notEqual(msg.secpayload, undefined);
                    assert.notEqual(msg.secpayload, reply1.payload);
                    assert.equal(conn.otp, undefined);
                    assert.equal(msg.token, undefined);
                    assert.equal(msg.otp, undefined);
                    
                    return Promise.resolve(enc.decrypt(msg, {connection: clientConn}));
                })
                .then(function() {
                    assert.equal(msg.secpayload, undefined);
                    assert.equal(msg.payload, reply1.payload);
                })
                .then(function() {
                    assert.equal(serverConn.isMature, true);
                    assert.equal(clientConn.isMature, true);
                    done();
                })
                .catch(function(e) {
                    console.log(e.message, '\n', e.stack);
                    assert(false);
                    done();
                });
            });
    
        });
    });
    
})(describe, it, before, after);

