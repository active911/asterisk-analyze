var webpack=require('webpack');

module.exports={

	"entry"	:	"./src/app.js",
	"output":	{

		"path"		:	"./public/",
		"filename"	: "bundle.js"
	},
	"module":	{

		"rules"	:	[
			{ "test" : /\.css$/, "loader" : "style-loader!css-loader"},
			{ "test" : /\.json$/, "loader" : "json-loader"},
			{ "test" : /\.(png|woff|woff2|eot|ttf|svg)$/, "loader" : "url-loader?limit=100000"}
		]
	},
	"resolve" : {

		"alias" : {
			"crossfilter" : "crossfilter2"
		}
	},
	"devtool" : "#source-map",
	"plugins" : [
		new webpack.ProvidePlugin({
			jQuery: 'jquery',
			$: 'jquery',
			jquery: 'jquery'

		})

	]
		

};

if(process.env.NODE_ENV=='production') {

	// Prod only. 

	// Transcode to es5
	module.exports.module.rules.push({ 
				test : /\.js$/,
				loader: "babel-loader",			
				exclude: /node_modules/,
				query: { presets: ['es2015']}
			});

	// Minify
	module.exports.plugins.push(new webpack.optimize.UglifyJsPlugin({minimize:true}));
} else {

	// Dev only

	// Expose jquery so we can debug with less pain...
	module.exports.module.rules.push({
//		test: require.resolve('jquery'),
		test: /jquery\.js$/,
		loader: "expose-loader?jquery!expose-loader?$"
	});

}