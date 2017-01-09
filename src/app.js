// var promise=require("bluebird");
require ('./styles.css');
// var crossfilter = require('crossfilter');
// var d3 = require('d3');
// var dc = require('dc');
//var $ = require('jquery');


// Data and dimensions
//var data=require("./calls.json");

$(document).ready(()=>{

	$.getJSON("/api/calls/2017/1").then((data)=>{

		console.log(data.length);

	});

// 	var cf=crossfilter([]);

// 	// TODO
// 	// - Create an array contining only people who actually queued
// 	// - Use this to create the average queue time (below)
// 	// - Also use this to create the queue time dimension and group
// 	// - Remove the ugly filter related code
// 	// - Make queue times show up as percentages

// 	// Queue time histogram.  Groups are created by taking 10 second "buckets"
// 	var queue_time_dim=cf.dimension((d) => (d.enqueued && d.answered)?((new Date(d.answered)) - (new Date(d.enqueued)) )/1000:null);
// 	var queue_time_group=queue_time_dim.group((v)=>{

// 		if (v===null ) return -1;

// 		var bucket=Math.ceil(v/10)*10;
// 		return (bucket<200)?bucket:200;
// 	});	
// 	// console.log(JSON.stringify(queue_time_group.all()));

// 	var queue_time_chart=dc.barChart('#queue_time');
// 	queue_time_chart
// 		.width(640)
// 		.height(480)
// 		.margins({top: 10, right: 50, left: 50, bottom: 40})
// 		.xAxisLabel("Seconds")
// 		//.yAxisLabel("")
// 		.dimension(queue_time_dim)
// 		.group(queue_time_group)
// 		//.x(d3.scale.ordinal().domain([10,20,30,40,50,60,70]))
// 		.x(d3.scale.ordinal().domain(queue_time_group.all().map((o)=>{return o.key;}).filter((v)=>v>0)))	// Filter negative queue times since it means they were never in the queue
// 		.xUnits(dc.units.ordinal)
// 		.render();



// 	// Average queue time
// 	var average_queue_time="too long"; // Figure out some other way
// 		// (queue_time_group.all().filter((v)=>v.key!=null).map((o)=>{return o.key*o.value}).reduce((a,b)=>a+b,0))/
// 		// (queue_time_group.all().filter((v)=>v.key!=null).map((o)=>{return o.value}).reduce((a,b)=>a+b,0));
// 	$("#stats").text("Average queue time "+average_queue_time+"s");

// 	// Extensions
// 	var extension_dim=cf.dimension((d)=>d.answered_by);
// 	var extension_group=extension_dim.group();
// 	var keys=extension_group.top(Infinity).map((o)=>{return o.key;});
// 	var extension_chart=dc.barChart('#extensions');
// 	extension_chart
// 		.width(640)
// 		.height(480)
// 		.margins({top: 10, right: 50, left: 50, bottom: 80})
// 		.yAxisLabel("Calls")
// //		.xAxisLabel("Extension")
// 		.dimension(extension_dim)
// 		.group(extension_group)
// 		.x(d3.scale.ordinal().domain(keys))
// 		.xUnits(dc.units.ordinal)
// 		.on("renderlet",(chart)=>{

// 			// Thanks http://stackoverflow.com/questions/25026010/show-values-on-top-of-bars-in-a-barchart
// 		    var barsData = [];
// 		    var bars = chart.selectAll('.bar').each(function(d) { barsData.push(d); });

// 		    //Remove old values (if found)
// 		    d3.select(bars[0][0].parentNode).select('#inline-labels').remove();
// 		    //Create group for labels 
// 		    var gLabels = d3.select(bars[0][0].parentNode).append('g').attr('id','inline-labels');

// 		    for (var i = bars[0].length - 1; i >= 0; i--) {

// 		        var b = bars[0][i];
// 		        //Only create label if bar height is tall enough
// 		        if (+b.getAttribute('height') < 18) continue;

// 		        gLabels
// 		            .append("text")
// 		            .text(barsData[i].data.value)
// 		            .attr('x', +b.getAttribute('x') + (b.getAttribute('width')/2) )
// 		            .attr('y', +b.getAttribute('y') + 15)
// 		            .attr('text-anchor', 'middle')
// 		            .attr('fill', 'white');
// 		    }

// 		})
// 		.render();



});
