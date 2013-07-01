/*

	(The MIT License)

	Copyright (C) 2005-2013 Kai Davenport

	Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 */

/*
  Module dependencies.
*/

var _ = require('lodash');
var async = require('async');
var EventEmitter = require('events').EventEmitter;
var engines = require('consolidate');
var http = require('http');
var passport = require('passport');
var express = require('express');
var partials = require('express-partials');
var socketio = require('socket.io');
var url = require('url');
var fs = require('fs');
var send = require('send');
var RedisStore = require('connect-redis')(express);

module.exports = factory;

function factory(options){

  options = options || {};

  options = _.defaults(options, {
    port:80,
    document_root:__dirname+'/www',
    view_root:__dirname+'/views',
    templates:null,
    cookieKey:'sdf8sdfsd8f78sd78',
    cookieSecret:'sedf98s7dfjsdfi',
    auth:null,
    redis:{
      host:'127.0.0.1',
      port:6379
    }
  })

  var app = express();
  var server = http.createServer(app);
  var preparestack = {
    before:[],
    normal:[],
    after:[]
  };

  app.prepare = function(phase, fn){
    if(!fn){
      fn = phase;
      phase = null;
    }
    phase = phase || 'normal';
    if(!preparestack[phase]){
      preparestack[phase] = [];
    }
    preparestack[phase].push(fn);
  }

  app.run_prepares = function(){
    var groups = _.map([
      'before',
      'normal',
      'after'
    ], function(phase){
      return preparestack[phase];
    })

    _.each(groups, function(arr){
      _.each(arr, function(fn){
        fn.apply(app, []);
      })
    })
  }

  /*
  
    SOCKETS
    
  */
  if(options.sockets){
    app.io = socketio.listen(server);

    if(process.env.NODE_ENV=='production'){
      app.io.enable('browser client minification');
      app.io.enable('browser client etag');
      app.io.enable('browser client gzip');
    }
    
    app.io.set('log level', 1);
    app.io.set('transports', [
      'websocket',
      'flashsocket',
      'htmlfile',
      'xhr-polling',
      'jsonp-polling'
    ])
  }

  /*

    CORE
    
  */
  app.sessionStore = new RedisStore(options.redis);
  app.use(express.favicon(options.favicon));
  app.use(express.query());
  app.use(express.responseTime());
  app.use(express.cookieParser(options.cookieSecret));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.session({
    store: app.sessionStore,
    secret: options.cookieSecret
  }))

  if(options.auth){
    app.use(passport.initialize());
    app.use(passport.session());
    app.passport = passport;  
  }


  /*
  
    ERROR & CACHING
    
  */
  app.configure('development', function(){
    //app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    app.use(function(req, res, next){

      /*
      
        no-caching unless we are live
        
      */
      res.on('header', function(){
        res.setHeader('cache-control', 'no-cache');
        res.setHeader('pragma', 'no-cache');
        res.setHeader('expires', '-1');
      })
      next();
    })
  })

  app.configure('production', function(){
    //app.use(express.errorHandler());
  })


  /*
  
    TEMPLATES
    
  */
  if(options.templates){
    app.engine('ejs', engines.ejs);
    app.set('view engine', 'ejs');
    app.set('views', options.view_root);
    app.use(partials());
  }

  app.start = function(done){
   
    app.run_prepares();
    app.use(app.router);

    /*
    
      static file server
      
    */
    if(fs.existsSync(options.document_root)){

      app.use(function(req, res, next){

        function error(err) {
          res.statusCode = err.status || 500;
          res.end(err.message);
        }

        function redirect() {
          res.statusCode = 301;
          res.setHeader('Location', req.url + '/');
          res.end('Redirecting to ' + req.url + '/');
        }

        function emitstream() {
          app.emit('stream', true);
        }

        send(req, url.parse(req.url).pathname)
          .root(options.document_root)
          .on('error', error)
          .on('directory', redirect)
          .on('stream', emitstream)
          .pipe(res);
      })
    }

    server.listen(options.port || 80, function(error){
      app.emit('started');
      if(done){
        done(error);
      }
    })
  }
  
  return app;
}




          /*
      if(options.sockets){
        app.io.set('authorization', passportSocketIo.authorize({
          key:'connect.sid',
          cookieParser:app.cookieParser,
          store:app.sessionStore,
          secret:options.cookieSecret,
          fail:function(data, accept){
            accept(null, true);
          },
          success:function(data, accept) {
            accept(null, true);
          }
        }))
      }
      */
