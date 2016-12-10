var webpack=require('webpack');

module.exports={

	"entry"	:	"./src/app.js",
	"output":	{

		"path"		:	"./public/",
		"filename"	: "bundle.js"
	},
	"module":	{

		"loaders"	:	[

			{ "test" : /\.css$/, "loader" : "style-loader!css-loader"},
			{ "test" : /\.json$/, "loader" : "json-loader"}
		]
	},
	"devtool" : "#source-map"
	// ,

	// "externals": {
 //    	'jsdom': 'window'
 //   },

 // //   "target" : "node",
	// ,
	// "plugins" : [
		
	// 	new webpack.IgnorePlugin(/jsdom$/)
	// ]
	// ,
	// "node" : {

	// 	"jsdom" : "empty"
	// }


};