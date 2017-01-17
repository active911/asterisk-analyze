// var promise=require("bluebird");
require ('./styles.css');
require("../node_modules/bootstrap/dist/css/bootstrap.min.css");
var crossfilter = require('crossfilter');
var d3 = require('d3');
var dc = require('dc');
var $ = require('jquery');
var bootstrap = require("bootstrap");




// Data and dimensions
//var data=require("./calls.json");

$(document).ready(()=>{

	$.getJSON("/api/calls/2017/1").then((o)=>{

		// Create ring data, add custom attributes (like queue time)
		var ring_data=[];
		let queue_time=0, queuers=0;
		for (let c of o.data){

			// Set a default queue tume
			c.attributes.queue_time=null;

			if(c.attributes.answered){

				// Compile ring data
				for(let ext of Object.keys(c.attributes.rang)) {
					ring_data.push({"ext": ext, "time": (new Date(c.attributes.answered)-new Date(c.attributes.rang[ext]))/1000});
				}

				// Calculate queue time
				if(c.attributes.enqueued) {

					c.attributes.queue_time=(new Date(c.attributes.answered)-new Date(c.attributes.enqueued))/1000;	// Call was enqueued and then answered
				} else {

					if(c.attributes.end && Object.keys(c.attributes.rang).length) {

						c.attributes.queue_time=(new Date(c.attributes.end)-new Date(c.attributes.enqueued))/1000;		// Call was not answered, but rang at least once before it ended
					}				
				}
			}

			// Calculate queue time
			if(c.attributes.queue_time!==null){

				queue_time+=c.attributes.queue_time;
				queuers++;
			}

		}

		// Average queue time
		var average_queue_time=(queuers>0)?(queue_time/queuers):0;
		console.log(average_queue_time+" for "+queuers);

		// TODO: Replace with Crossfilter code
		// Find calls that were enqueued and answered, or enqueued and rang.  Hangups that never rang are ignored.
		var qrs=o.data.map((c)=>{

			if(c.attributes.enqueued){

				if(c.attributes.answered) {

					return (new Date(c.attributes.answered)-new Date(c.attributes.enqueued))/1000;	// Call was enqueued and then answered
				} else {

					if(c.attributes.end && Object.keys(c.attributes.rang).length) {

						return (new Date(c.attributes.end)-new Date(c.attributes.enqueued))/1000;		// Call was not answered, but rang at least once before it ended
					}				
				}
			}

			return null;	// Default is to exclude the call
		}).filter((c)=>(c!==null));
		//$("#stats").text("Average queue time "+(qrs.reduce((a,v)=>a+v,0)/qrs.length)+"s");
		var aqt=(qrs.reduce((a,v)=>a+v,0)/qrs.length);
		console.log(aqt+" for "+qrs.length);

		// Crossfilter ring data
		var rings=crossfilter(ring_data);
		var rings_dim=rings.dimension((o)=>o.ext);
		var rings_group=rings_dim.group().reduce(
			(p,v)=>{	// Add

				p.calls++;
				p.seconds+=v.time;
				p.average=p.calls?(p.seconds/p.calls):0;
				return p;
			},
			(p,v)=>{	// Remove

				p.calls--;
				p.seconds-=v.time;
				p.average=p.calls?(p.seconds/p.calls):0;
				return p;
			},
			()=>{
					return {
						calls: 0,
						seconds: 0,
						average: 0
					};
			});

		// Average ring time before answer
		var ring_time_chart=dc.barChart('#rings');
		ring_time_chart
			.width(640)
			.height(480)
			.margins({top: 10, right: 50, left: 50, bottom: 80})
			.yAxisLabel("Seconds")
			.valueAccessor(o=>o.value.average)
			.dimension(rings_dim)
			.group(rings_group)
			.x(d3.scale.ordinal().domain(rings_group.top(Infinity).map(o=>o.key)))
			.xUnits(dc.units.ordinal)
			.render();


		// Crossfilter, queue time
		var cf=crossfilter(o.data);
		var queue_time_dim=cf.dimension((c) => c.attributes.queue_time);
		var queue_time_group=queue_time_dim.group((v)=>{
			
			// Queue time histogram.  Groups are created by taking 10 second "buckets"
			if (v===null ) return -1;

			var bucket=Math.ceil(v/10)*10;
			return (bucket<200)?bucket:200;
		});	

		// Time in queue
		dc.barChart('#queue_time')
			.width(640)
			.height(480)
			.margins({top: 10, right: 50, left: 50, bottom: 40})
			.xAxisLabel("Seconds")
			.dimension(queue_time_dim)
			.group(queue_time_group)
			.x(d3.scale.ordinal().domain(queue_time_group.all().map((o)=>{return o.key;}).filter((v)=>v>0)))	// Filter negative queue times since it means they were never in the queue
			.xUnits(dc.units.ordinal)
			.render();




		// Call load by extension
		var extension_dim=cf.dimension((d)=>d.attributes.answered_by||"unanswered");
		var extension_group=extension_dim.group().reduceCount();
		dc.barChart('#extensions')
			.width(640)
			.height(480)
			.margins({top: 10, right: 50, left: 50, bottom: 80})
			.yAxisLabel("Calls")
			.dimension(extension_dim)
			.group(extension_group)
			.x(d3.scale.ordinal().domain(extension_group.top(Infinity).map((o)=>{return o.key;})))
			.xUnits(dc.units.ordinal)
			.on("renderlet",draw_bar_labels)
			.render();

	});
});


/**
 * Helper: draw labels on bars within bar graph
 *
 * Thanks http://stackoverflow.com/questions/25026010/show-values-on-top-of-bars-in-a-barchart
 */
function draw_bar_labels(chart){

    var barsData = [];
    var bars = chart.selectAll('.bar').each(function(d) { barsData.push(d); });

    //Remove old values (if found)
    if(bars[0][0].parentNode) d3.select(bars[0][0].parentNode).select('#inline-labels').remove();
    //Create group for labels 
    var gLabels = d3.select(bars[0][0].parentNode).append('g').attr('id','inline-labels');

    for (var i = bars[0].length - 1; i >= 0; i--) {

        var b = bars[0][i];
        //Only create label if bar height is tall enough
        if (+b.getAttribute('height') < 18) continue;

        gLabels
            .append("text")
            .text(barsData[i].data.value)
            .attr('x', +b.getAttribute('x') + (b.getAttribute('width')/2) )
            .attr('y', +b.getAttribute('y') + 15)
            .attr('text-anchor', 'middle')
            .attr('fill', 'white');
    }

}

