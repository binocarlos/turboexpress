var request = require('request');
var Turbo = require('../src');

describe('turboexpress', function(){

	it('should be a function', function() {
		Turbo.should.be.a('function');
		
	})

	it('should host a simple website and emit events', function(done){

		this.timeout(1000);
		
		var webserver = Turbo({
			port:8080,
			document_root:__dirname + '/fixtures/www'
		})

		var hit = {};

		webserver.on('started', function(){
			hit.started = true;
		})

		webserver.on('stream', function(){
			hit.stream = true;
		})

		webserver.start(function(){

			request('http://127.0.0.1:8080', function (error, response, body) {
				if (!error && response.statusCode == 200) {
					body.should.equal('hello world');
					hit.started.should.equal(true);
					hit.stream.should.equal(true);
					done();
				}
			})
		})
	})

})