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
			{ "test" : /\.json$/, "loader" : "json-loader"}
		]
	},
	"devtool" : "#source-map",
	"plugins" : []
		

};

if(process.env.NODE_ENV=='production') {

	module.exports.module.rules.push({ 
				test : /\.js$/,
				loader: "babel-loader",
				exclude: /node_modules/,
				query: { presets: ['es2015']}
			});
	module.exports.plugins.push(new webpack.optimize.UglifyJsPlugin({minimize:true}));
};