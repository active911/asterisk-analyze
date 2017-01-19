
// Mostly stolen from https://www.npmjs.com/package/html5-lint

var fs = require( 'fs' ),
    html5Lint = require( 'html5-lint' );
 
fs.readFile( 'public/index.html', 'utf8', function( err, html ) {
  if ( err )
    throw err;
 
  html5Lint( html, function( err, results ) {

    // Print the messages
    results.messages.forEach( function( msg ) {
      var type = msg.type, // error or warning 
      message = msg.message;
 
      console.log( "HTML5 Lint [%s]: %s", type, message );
    });

    process.exit(results.messages.length?1:0);
  });
});