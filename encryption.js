/***
 * Author: Charles Huang <huangc.cd@gmail.com>
 * Date: 3/24/2015
 * Project: backpak
 * 
 * This file implements encryption mechanism for the transport
 * 
 */

(function(backpak, inBrowser, undefined) {
    // wrapping function to provide name space and browser/node detection
    
    function nop(){}
    
    var _ = (inBrowser ? window._ : require('lodash'));
    var Promise = (inBrowser ? window.Promise : require('bluebird'));
    var rsa = (!inBrowser && require('node-rsa'));
    var CryptoJS = (inBrowser && window.CryptoJS);
    var Crypto = (!inBrowser && require('crypto'));
    var PBKDF2 = (inBrowser && window.PBKDF2);
    var chance = (!inBrowser && new (require('chance'))());
    var JSEncrypt = (inBrowser && window.JSEncrypt);

    function getKey(conn) {
        if (!conn.serverKey) {
            if (inBrowser) {
                conn.serverKey = new JSEncrypt();
                conn.serverKey.setKey(conn.handler.cfg.serverKey);
            } else
                conn.serverKey = new rsa(conn.handler.cfg.serverKey, {encryptionScheme: 'pkcs1'});
        }
        return conn.serverKey;
    }

    var encryption = {};
    encryption.decrypt = function(msg, context) {
        var conn = context.connection;
        var secret;
        if (msg.otp) {
            // this happens on server side
            // use otp to find and deliver token and secret
            if (conn.otp || conn.token || conn.secret) {
                throw new Error('Unexpected OTP');
            }
            secret = getKey(conn).decrypt(msg.otp, 'utf-8', 'base64');
            conn.handler.logger.debug('the otp: ' + secret);
            conn.otp = secret;
        } else {
            // server should use token secret to decode message
            // client might need to use otp when secert is not there
            secret = conn.secret || conn.otp;
            
            // when secret and otp are not available on server side
            // get the secret from session storage
            if (!secret && msg.token) {
                secret = conn.handler.getSecret(msg.token);
                conn.secret = secret;
            }
                
            if (!secret)
                throw new Error('Unable to find the secret to decrypt the secpayload');
            
            // when the token is agreed on both end,
            // the connection is mature, no need to send token anymore
            conn.token = conn.token || msg.token;
            if (conn.token) {
                conn.isMature = true;
                context.token = conn.token;
            }
        }
        
        return Promise.resolve(secret)
        .then(function(secret) {
            var key;
            if (inBrowser) {
                key = PBKDF2(secret, msg.time.toString().slice(-8), {keySize: 256/32, iteration: 16});
                msg.payload = JSON.parse(CryptoJS.AES.decrypt(msg.secpayload, key, {iv: msg.iv}));

            } else {
                key = Crypto.pbkdf2Sync(secret, msg.time.toString().slice(-8), 16, 256);
                var c = Crypto.createDecipher('aes256', key, msg.iv);
                msg.payload = JSON.parse(c.update(msg.secpayload, 'base64', 'utf-8') + c.final('utf-8'));
            }
            if (!msg.payload)
                throw new Error('Failed to decrypt secpayload');
            delete msg.secpayload;
            return msg.payload;
        });
        
    };
    
    encryption.verifyPayload = function() {
        
    };

    encryption.encrypt = function(msg, context) {
        var conn = context.connection;
        msg.time = (new Date()).getTime();
        var pass;
        
        if (conn.otp) {
            pass = conn.otp;
            delete conn.otp;
        } else if (conn.token && conn.secret) {
            if (!conn.isMature) msg.token = conn.token;
            pass = conn.secret;
        } else {
            conn.otp = chance.string({length: 8});
            if (inBrowser) {
                msg.otp = getKey(conn).encrypt(conn.otp, 'base64');
            } else {
                msg.otp = getKey(conn).encrypt(conn.otp, 'base64');
            }
            pass = conn.otp;
        }

        var key;
        if (inBrowser) {
            key = PBKDF2(pass, msg.time.toString().slice(-8), {keySize: 256/32, iteration: 16});
            msg.iv = chance.string({length: 16});
            msg.secpayload = CryptoJS.AES.encrypt(JSON.stringify(msg.payload), key, {iv: msg.iv}).toString();
        } else {
            key = Crypto.pbkdf2Sync(pass, msg.time.toString().slice(-8), 16, 256);
            msg.iv = chance.string({length: 16});
            var c = Crypto.createCipher('aes256', key, msg.iv);
            msg.secpayload = c.update(JSON.stringify(msg.payload), 'utf-8', 'base64') + c.final('base64');
        }
        
        delete msg.payload;
        return msg.secpayload;
    };
    
    encryption.makeSignature = function() {
        
    };
    
    encryption.tokenizeIncoming = function(msg, context) {
        if (context.connection.otp && !msg.otp && msg.payload.token) {
            context.connection.token = msg.payload.token.token;
            context.connection.secret = msg.payload.token.secret;
            context.connection.isMature = true;
            delete context.connection.otp;
        }
    };
    
    encryption.tokenizeOutgoing = function(result, msg, context) {
        if (context.connection.otp && msg.otp && result.token) {
            context.connection.token = result.token.token;
            context.connection.secret = result.token.secret;
            context.connection.isMature = true;
            context.connection.handler.storeSecret(result.token.token, result.token.secret);
        }
    };
    
    if (inBrowser) {
        backpak.encryption = encryption;
    } else {
        module.exports = encryption;
    }

})(module ? {} : (window.backpak = (window.backpak || {})), module ? false : true);
