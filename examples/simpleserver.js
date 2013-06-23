var request = require('request');
var Turbo = require('../src');

var webserver = Turbo({
	port:80,
	document_root:__dirname + '/../test/fixtures/www'
})

webserver.start(function(){

})