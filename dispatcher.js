/***
 * Author: Charles Huang <huangc.cd@gmail.com>
 * Date: 4/7/2015
 * Project: backpak
 * 
 * This file implements routing mechanism for the API server
 * 
 */

var _ = require('lodash');
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;

function dispatcher(handler) {
    EventEmitter.call(this);
    var disp = this;
    this.svr = handler;
    this.routes = {
        _api: { getCatalog: function() { return disp.discover(); }, },
    };
    disp.on('error', this.svr.emit.bind(this.svr, 'error'));
    this.ready = this.dicover();
}

dispatcher.prototype = Object.create(EventEmitter.prototype);
dispatcher.prototype.constructor = dispatcher;

_.merge(dispatcher.prototype, {
    dispatch: function(req, ctx) {
        var moduleName = req.module.replace(/[\.\/]/g,'');
        var module = this.routes[moduleName];
        if (!module) {
            try {
                module = this.routes[moduleName] = require(this.svr.cfg.modules + '/' + req.module.replace(/^_*/g,''));
            } catch(e) {
                throw new Error('invalid module: ' + req.module);
            }
        }
        
        var methodName = req.method.replace(/^_*/g,'');
        if (!module.hasOwnProperty(methodName)) {
            throw new Error('invalid method: ' + req.method);
        }
        
        var method = module[methodName];
        method._meta = method._meta || {
            params : method.toString().split(/[\(\)]/)[1].split(/\s*,+\s*/),
        };
        
        var args = [];
        // apply named parameters
        if (req.params) {
            
            _.forEach(method._meta.params, function(param) {
                if (param in req.params)
                    args.push(req.params[param]);
                else
                    args.push(undefined);
            });
        }
        
        // apply the rest positional parameters
        if (req.params && req.params._rest)
            Array.prototype.push.apply(args, req.params._rest);
            
        this.svr.logger.info('dispatching to ' + moduleName + '.' + methodName);
        return method.apply(ctx, args);
    },
    
    discover: function() {
        var disp = this;
        
        if (!disp.catalog) {
            fs.readdirSync(this.svr.cfg.modules).forEach(function(file) {
                if (file[0]!=='_' && file[0]!=='.') {
                    var name = file.slice(0, -3);
                    if (!(name in disp.routes)) {
                        try {
                            disp.routes[name] = require(disp.svr.cfg.modules + '/' + name);
                        } catch(e) {
                            disp.svr.logger.warn('invalid module: ' + name);
                            disp.svr.logger.warn(e.message + '\n' + e.stack);
                        }
                    }
                }
            });
            disp.catalog = _.reduce(disp.routes, function(mods, module, moduleName) {
                var methods = {};
                for (var name in module) {
                    if (typeof module[name] === 'function' && name.slice(0,1) !== '_') {
                        var method = module[name];
                        method._meta = method._meta || {
                            params : method.toString().split(/[\(\)]/)[1].split(/\s*,+\s*/),
                        };
                        if (method._meta[0]==='') {
                            method._meta = [];
                        }
                        methods[name] = method._meta;
                    }
                }
                mods[moduleName] = methods;
                return mods;
            }, {});
        }
        // todo ACL
        return disp.catalog;
    },
});

module.exports = dispatcher;
