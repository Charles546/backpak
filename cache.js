/***
 * Author: Charles Huang <huangc.cd@gmail.com>
 * Date: 4/7/2015
 * Project: backpak
 * 
 * This file implements a cache storing token secret and state related info
 * 
 */

var redis = require('then-redis');
var events = require('events');
var _ = require('lodash');

function cache(handler) {
    events.EventEmitter.call(this);
    this.svr = handler;
    this.svr.cache = this;
    this.redis = redis.createClient(handler.cfg.cache.redis);
    this.redis.on('error', this.svr.emit.bind(this.svr, 'error'));
    this.ready = this.redis;
}

cache.prototype = Object.create(events.EventEmitter.prototype);
cache.prototype.constructor = cache;
_.merge(cache.prototype, {
    get: function(key) {
        return this.redis.get('backpak:' + key);
    },
    set: function(key, value) {
        return this.redis.set('backpak:' + key, value);
    },
});

module.exports = cache;
