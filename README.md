turboexpress
============

A quick way to get a node.js express website booted

```js

var Turbo = require('../src');

var webserver = Turbo({
	port:80,
	document_root:__dirname + '/../test/fixtures/www'
})

webserver.start(function(){
	
	// yay we have a turbo express
	
})

```