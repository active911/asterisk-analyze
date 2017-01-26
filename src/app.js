// var promise=require("bluebird");
require ('./styles.css');
require("../node_modules/bootstrap/dist/css/bootstrap.min.css");
require("../node_modules/dc/dc.min.css");
var crossfilter = require('crossfilter2');
var d3 = require('d3');
var dc = require('dc');
var $ = require('jquery');
var bootstrap = require("bootstrap"); /* jshint ignore:line */ // (supress unused variable warning)
var ReconnectingWebSocket=require("reconnectingwebsocket");
var moment=require("moment");

var chart_size={
	width: 450,
	height: 300
};

/**
 * Calculate queue time
 *
 * Helper function to calculate time in queue for a call
 * @param {call} call - the call 
 * @return time in queue (s) or null
*/
function queue_time(c){

	if(c.attributes.enqueued) {
		if(c.attributes.answered) {

			return (new Date(c.attributes.answered)-new Date(c.attributes.enqueued))/1000;	// Call was enqueued and then answered

		} else {

			if(c.attributes.end && Object.keys(c.attributes.rang).length) {

				return (new Date(c.attributes.end)-new Date(c.attributes.enqueued))/1000;		// Call was not answered, but rang at least once before it ended
			}				
		}
	}

	return null;	// Default
}

$(document).ready(()=>{

	var m=(new moment()).subtract(12, "months");
	for(let n=0; n<12; n++){

		m.add(1, "months");
		$("#date").append($("<option />").text(m.format("MMM YYYY")).val(m.toISOString()));
	}
	$("#date option:last-child").attr("selected", true);

	$("#date").on("change",()=>{

		m=moment($("#date").val());
		$.getJSON("/api/calls/"+m.year()+"/"+(1+m.date())).then((o)=>{

			// Calculate queue time for each call
			for (let c of o.data) c.attributes.queue_time=queue_time(c);

			// Yay crossfilter!
			var cf=crossfilter(o.data);

			// Get new calls from Websockets
			let host=window.document.location.host;//replace(/:.*/,'');
			var ws=new ReconnectingWebSocket("ws://"+host);
			ws.onmessage=(e)=>{

				console.log("New ws data: "+e.data);

				// Create a new call item
				let call={
					type: "call",
					id: 0,
					attributes: JSON.parse(e.data)
				};
				call.attributes.queue_time=queue_time(call);

				// Add the new call
				cf.add([call]);
				dc.redrawAll();
			};


			var calls_by_answerer=cf.dimension((c)=>(c.attributes.answered_by||"unanswered").toString());
			var call_time_group_by_answerer=calls_by_answerer.group().reduce(
				(p,v)=>{	// Add

					if(v.attributes.answered && v.attributes.end) {
						p.calls++;
						p.minutes+=((new Date(v.attributes.end)-new Date(v.attributes.answered))/60000);
						p.average=p.calls?p.minutes/p.calls:0;
					}
					return p;
				},
				(p,v)=>{	// Remove

					if(v.attributes.answered && v.attributes.end) {
						p.calls--;
						p.minutes-=(new Date(v.attributes.end)-new Date(v.attributes.answered))/60000;
						p.average=p.calls?p.minutes/p.calls:0;
					}
					return p;
				},
				()=>{
						return {
							calls: 0,
							minutes: 0,
							average: 0
						};
				});

			// Average call time by answerer
			var call_time_chart=dc.barChart('#length');
			call_time_chart
				.width(chart_size.width)
				.height(chart_size.height)
				.margins({top: 10, right: 50, left: 50, bottom: 100})
				.yAxisLabel("Minutes")
				.valueAccessor(o=>o.value.average)
				.dimension(calls_by_answerer)
				.group(call_time_group_by_answerer)
				.x(d3.scale.ordinal().domain(call_time_group_by_answerer.top(Infinity).map(o=>o.key)))
				.xUnits(dc.units.ordinal)
				.on("renderlet",chart=>draw_bar_labels(chart,(o)=>o.average.toFixed(1)))
				.turnOnControls(true)
				.render();

			// Setup reset button
			$("#length a.reset")
				.css("display","none") // Change to visibility,hidden in future dc.js releases
				.click(()=>{
					call_time_chart.filterAll();
					dc.redrawAll();
				});

			var ring_time_group_by_answerer=calls_by_answerer.group().reduce(
				(p,v)=>{	// Add

					if(v.attributes.answered && v.attributes.answered_by && v.attributes.rang[v.attributes.answered_by]) {
						p.calls++;
						p.seconds+=(new Date(v.attributes.answered)-new Date(v.attributes.rang[v.attributes.answered_by]))/1000;
						p.average=p.calls?p.seconds/p.calls:0;
					}
					return p;
				},
				(p,v)=>{	// Remove

					if(v.attributes.answered && v.attributes.answered_by && v.attributes.rang[v.attributes.answered_by]) {
						p.calls--;
						p.seconds-=(new Date(v.attributes.answered)-new Date(v.attributes.rang[v.attributes.answered_by]))/1000;
						p.average=p.calls?p.seconds/p.calls:0;
					}
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
				.width(chart_size.width)
				.height(chart_size.height)
				.margins({top: 10, right: 50, left: 50, bottom: 100})
				.yAxisLabel("Seconds")
				.valueAccessor(o=>o.value.average)
				.dimension(calls_by_answerer)
				.group(ring_time_group_by_answerer)
				.x(d3.scale.ordinal().domain(ring_time_group_by_answerer.top(Infinity).map(o=>o.key)))
				.xUnits(dc.units.ordinal)
				.on("renderlet",chart=>draw_bar_labels(chart,(o)=>o.average.toFixed(1)))
				.turnOnControls(true)
				.render();

			// Setup reset button
			$("#rings a.reset")
				.css("display","none") // Change to visibility,hidden in future dc.js releases
				.click(()=>{
					ring_time_chart.filterAll();
					dc.redrawAll();
				});


			// Calls by day
			var day_dim=cf.dimension(c=>(new Date(c.attributes.start)).getDate());
			var day_group=day_dim.group();
			var daily_chart=dc.lineChart("#daily")
				.width(chart_size.width*2)
				.height(chart_size.height)
				.margins({top: 10, right: 50, left: 50, bottom: 40})
				.xAxisLabel(()=>m.format("MMMM YYYY"))	// "January 2017", etc
				.title((p)=>p.value+" calls")
				.renderTitle(true)
				.dimension(day_dim)
				// .brushOn(false)
				.group(day_group)
				// .x(d3.scale.ordinal().domain(day_group.all().map((o)=>{return o.key;})))
				.x(d3.scale.linear().domain([1,m.clone().endOf("month").date()]))
				// .x(d3.scale.time().domain([m.clone().startOf("month"),m.clone().endOf("month")]))
				// .xUnits(dc.units.ordinal)
				.turnOnControls(true)
				.on("renderlet",draw_bar_labels)
				.render();

			// Setup reset button
			$("#daily a.reset")
				.css("display","none") // Change to visibility,hidden in future dc.js releases
				.click(()=>{
					daily_chart.filterAll();
					dc.redrawAll();
				});



			// Time in queue
			var queue_time_dim=cf.dimension((c) => {

				let t=c.attributes.queue_time;
				return (t===null)?-1:
							(t===0)?10:
								Math.ceil(t/10)*10;
			});
			var queue_time_group=queue_time_dim.group();

			var total_shown_calls;
			var queue_time_chart=dc.barChart('#queue_time')
				.width(chart_size.width)
				.height(chart_size.height)
				.margins({top: 10, right: 50, left: 50, bottom: 40})
				.xAxisLabel("Max Seconds")
				.title((p)=>p.value+" calls")
				.renderTitle(true)
				.dimension(queue_time_dim)
				.group(queue_time_group)
				.elasticY(true)
				.x(d3.scale.ordinal().domain(queue_time_group.all().map((o)=>{return o.key;})))
				.valueAccessor(p=>p.value/total_shown_calls)
				.xUnits(dc.units.ordinal)
				.turnOnControls(true);

			// Chart events
			["preRender","preRedraw"].forEach(e=>queue_time_chart.on(e,(/*chart*/)=>{

				// Recalculate total shown calls and average hold time.
				total_shown_calls=queue_time_dim.top(Infinity).length;
				$("#average_queue_time").text((queue_time_dim.top(Infinity).reduce((p,v)=>p+v.attributes.queue_time,0)/(queue_time_dim.top(Infinity).filter(v=>v.attributes.queue_time!==null).length||1)).toFixed(1));
			}));

			// Clean up axes
			queue_time_chart.yAxis().tickFormat(v=>Math.round(v*100)+"%");
			queue_time_chart.xAxis().tickFormat(v=>(v==-1)?"n/a":v);
			queue_time_chart.render();

			// Setup reset button
			$("#queue_time a.reset")
				.css("display","none") // Change to visibility,hidden in future dc.js releases
				.click(()=>{
					queue_time_chart.filterAll();
					dc.redrawAll();
				});


			// Call counts by answerer
			var call_count_group_by_answerer=calls_by_answerer.group();
			var destination_chart=dc.barChart('#destinations')
				.width(chart_size.width)
				.height(chart_size.height)
				.margins({top: 10, right: 50, left: 50, bottom: 100})
				.dimension(calls_by_answerer)
				.group(call_count_group_by_answerer)
				.x(d3.scale.ordinal().domain(()=>call_count_group_by_answerer.all().map((o)=>{return o.key;})))
				// .x(d3.scale.ordinal().domain(call_count_group_by_answerer.all().map((o)=>{return o.key;})))
				.xUnits(dc.units.ordinal)
				.on("renderlet",draw_bar_labels);


			// Make chart show percentages
			destination_chart
				.valueAccessor(p=>p.value/cf.size())
				.yAxis().tickFormat(d3.format(".0%"));
			destination_chart.render();

			// Setup reset button
			$("#destinations a.reset")
				.css("display","none") // Change to visibility,hidden in future dc.js releases
				.click(()=>{
					destination_chart.filterAll();
					dc.redrawAll();
				});

		});
	});

	// Trigger first change event
	$("#date").trigger("change");
});


/**
 * Recalculate thresholds
 *
 * We have to use several thresholds
 */


/**
 * Helper: draw labels on bars within bar graph
 *
 * Thanks http://stackoverflow.com/questions/25026010/show-values-on-top-of-bars-in-a-barchart
 */
function draw_bar_labels(chart, accessor=(o)=>o){

    var barsData = [];
    var bars = chart.selectAll('.bar').each(function(d) { barsData.push(d); });
    if(!bars[0] || !bars[0][0] || !bars[0][0].parentNode) return;

    //Remove old values (if found)
    d3.select(bars[0][0].parentNode).select('#inline-labels').remove();
    //Create group for labels 
    var gLabels = d3.select(bars[0][0].parentNode).append('g').attr('id','inline-labels');

    for (var i = bars[0].length - 1; i >= 0; i--) {

        var b = bars[0][i];
        //Only create label if bar height is tall enough
        if (+b.getAttribute('height') < 18) continue;

        gLabels
            .append("text")
            .text(accessor(barsData[i].data.value))
            .attr('x', +b.getAttribute('x') + (b.getAttribute('width')/2) )
            .attr('y', +b.getAttribute('y') + 15)
            .attr('text-anchor', 'middle')
            .attr('fill', 'white');
    }

}

