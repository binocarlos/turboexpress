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
var express = require('express');
var socketio = require('socket.io');
var RedisStore = require('./redisstore')(express);
var passportSocketIo = require('passport.socketio');
var url = require('url');
var fs = require('fs');
var send = require('send');

module.exports = factory;

function factory(options){

  options = _.defaults(options, {
    port:80,
    document_root:__dirname+'/www',
    view_root:__dirname+'/views',
    templates:null,
    cookieSecret:'sedf98s7dfjsdfi',
    redis:{
      host:'127.0.0.1',
      port:6379
    }
  })

  var app = express();
  var server = http.createServer(app);


  /*
  
    CORE
    
  */

  app.use(express.favicon(options.favicon));
  app.use(express.query());
  app.use(express.responseTime());
  app.use(express.bodyParser());

  app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
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
    app.use(express.errorHandler());
  })


  /*
  
    TEMPLATES
    
  */
  if(options.templates){
    app.engine('ejs', engines.ejs);
    app.set('view engine', 'ejs');
    app.set('views', options.view_root);
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
  
    AUTH
    
  */
  if(options.auth){

    app.cookieParser = express.cookieParser(options.cookieSecret);
    app.sessionStore = new RedisStore(options.redis);

    app.use(app.cookieParser);
    app.use(express.session({
      store: app.sessionStore,
      secret: options.cookieSecret
    }))

    if(options.sockets){
      app.io.set('authorization', passportSocketIo.authorize({
        key:'connect.sid',
        cookieParser:app.cookieParser,
        secret:options.cookieSecret,
        store:app.sessionStore,
        fail:function(data, accept){
          accept(null, true);
        },
        success:function(data, accept) {
          accept(null, true);
        }
      }))
    }
  }

  app.prepare = function(fn){
    this._prepare = fn;
  }

  app.start = function(done){
   
    if(this._prepare){
      this._prepare();
    }
    
    app.use(app.router);

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

    /*
    
      static file server
      
    */
    if(fs.existsSync(options.document_root)){

      app.use(function(req, res, next){
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