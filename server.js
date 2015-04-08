/***
 * Author: Charles Huang <huangc.cd@gmail.com>
 * Date: 2/28/2015
 * Project: backpak
 * 
 * This is the entry point for backpak api framework
 * 
 */

var _ = require('lodash');
var Promise = require('bluebird');
var cluster = require('cluster');
var events = require('events');
var numCPUs = require('os').cpus().length;
var defaultCfg = require('./defaultCfg');
var transport = require('./transport');
var dispatcher = require('./dispatcher');
var cache = require('./cache');

function server(config, opts) {
    events.EventEmitter.call(this);
    var svr = this;
    var onServerError = svr._onError.bind(svr);
    var onFatalError = function(e) {
        (svr.logger && svr.logger.error || console.log)('Fatal error: ', e.message, + '\n' + e.stack);
        svr.emit('error', e);
        svr.emit('cleanup', (svr.exitCode || 0) | 1);
    };
    
    try {
        svr.status = 'starting';
        svr.on('cleanup', svr._onCleanup.bind(svr));
        svr.on('error', onServerError);
        
        svr.cfg = _.merge(_.clone(defaultCfg), config);
        _.merge(svr.cfg, opts);
        svr.logger = svr.cfg.logger;
        
        svr.ready = [];
        if (svr.cfg.cluster.enabled && process.env.NODE_ENV !== 'DEV' && cluster.isMaster) {
            this.logger.info('Server forking');
            var threads = svr.cfg.cluster.threads || numCPUs - 1 || 1;
            for (var i = 0; i < threads; i++) {
                cluster.fork();
            }
            cluster.on('exit', function(worker, code, signal) {
                if (svr.status !== 'shutting down' && !worker.suicide) {
                    svr.emit('error', new Error('Worker ' + worker.process.pid + ' died (' + (signal || code || '') + ')'));
                    svr.logger.info('Re-spawning...');
                    cluster.fork();
                } else if (svr.status !== 'shutting down') {
                    svr.emit('error', new Error('Worker ' + worker.process.pid + ' suicide (' + (signal || code || '') + ')'));
                    svr.exitCode = (svr.exitCode || 0) | 0x80 | (signal || code);
                }
                if (!cluster.workers.length && svr.status==='shutting down') {
                    svr.status = 'stopped';
                    svr.emit('end', svr.exitCode || 0);
                }
            });
        } else {
            svr.transport = new transport(svr);
            svr.transport.on('error', onServerError);
            svr.ready.push(svr.transport.ready);
            svr.dispatcher = new dispatcher(svr);
            svr.dispatcher.on('error', onServerError);
            svr.ready.push(svr.dispatcher.ready);
        }
        svr.cache = new cache(svr);
        svr.cache.on('error', onServerError);
        svr.ready.push(svr.cache.ready);
        
        svr.ready = Promise.all(svr.ready)
        .then(function(all) {
            svr.status = 'running';
            return all;
        })
        .catch(onFatalError);
    } catch(e) {
        onFatalError(e);
    }
}

server.prototype = Object.create(events.EventEmitter.prototype);
server.prototype.constructor = server;

_.merge(server.prototype, {
    _onCleanup: function(exitCode) {
        var svr = this;
        svr.exitCode = exitCode;
        
        svr.logger.info('Exiting: cleaning up');
        
        if (svr.transport)
            svr.transport.end(exitCode);
        if (svr.disaptcher)
            svr.dispatcher.end(exitCode);
        if (svr.cache)
            svr.cache.end(exitCode);
            
        if (svr.cfg.cluster.enabled && process.env.NODE_ENV != 'DEV' && cluster.isMaster) {
             _.forEach(cluster.workers, function(worker) {
                worker.kill();
            });
        }
        
        if (cluster.isWorker) {
            cluster.worker.kill();
        }
    },
    _onError: function (e) {
        if (e && e.code==='EADDRINUSE') {
            this.logger.error('Address in use');
            // suicide, preventing re-spawning
            this.emit('cleanup', (this.exitCode || 0) | 1);
        } else {
            this.logger.error('Server error: %s\n%s', e.code, e.stack);
        }
    },
    stop: function (exitCode) {
        this.status = 'shutting down';
        this.logger.info('Server is shutting down');
        this.emit('cleanup', exitCode || 0);
    },
    defaultAcl: function(rules, payload, context) {
        function parseCondition(condstr) {
            var conds = condstr.split(',');
            conds = _.map(conds, function(cond) {
                var split = cond.indexOf(':');
                return [cond.slice(0,split), new RegExp(cond.slice(split+1))];
            });
        }
        
        function match(conds, target) {
            var isMatch = true;
            _.forEach(conds, function(cond) {
                isMatch = verdict && cond[1].test(target[cond[0]]);
                return isMatch;
            });
            return isMatch;
        }
        
        var defaultPermission = this.cfg.api.default.permission;
        var verdict = defaultPermission;
        _.forEach(rules, function(rule) {
            if (!(rule.who instanceof Array))
                rule.who = parseCondition(rule.who);
            if (!(rule.action instanceof Array))
                rule.action = parseCondition(rule.action);
                
            if (match(rule.who, context) && match(rule.action, payload)) {
                if (defaultPermission)
                    verdict = verdict && rule.allow;
                else
                    verdict = verdict || rule.allow;
            }
            if (verdict !== defaultPermission)
                return false;
        });
        
        return verdict;
    },
    dispatch: function(payload, context) {
        payload = JSON.parse(payload);
        var authorized = 1;
        if (!payload.type || payload.type==='api') {
            var acl = this.cfg.api.acl;
            if (acl) {
                if (typeof acl !== 'function') {
                    acl = this.defaultAcl.bind(this, this.cfg.api.acl);
                }
            }
            
            authorized = acl(payload, context);
        }
        
        var svr = this;
        return Promise.resolve(authorized)
        .then(function(authroized) {
            if (authorized) {
                return svr.dispatcher.dispatch(payload, context);
            } else
                throw new Error('Unauthorized API call');
        });
    },
    getSecret: function(token) {
        return this.cache.get("ts:" + token);
    },
    storeSecret: function(token, secret) {
        return this.cache.set("ts:" + token, secret);
    },
});

module.exports = server;
