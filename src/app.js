// var promise=require("bluebird");
require ('./styles.css');
require("../node_modules/bootstrap/dist/css/bootstrap.min.css");
require("../node_modules/dc/dc.min.css");
var crossfilter = require('crossfilter');
var d3 = require('d3');
var dc = require('dc');
var $ = require('jquery');
var bootstrap = require("bootstrap");
var moment=require("moment");




// Data and dimensions
//var data=require("./calls.json");

$(document).ready(()=>{

	var m=(new moment()).subtract(12, "months");
	for(n=0; n<12; n++){

		m.add(1, "months");
		$("#date").append($("<option />").text(m.format("MMM YYYY")).val(m.toISOString()));
	}
	$("#date option:last-child").attr("selected", true);

	$("#date").on("change",(me)=>{

		m=moment($("#date").val());
		$.getJSON("/api/calls/"+m.year()+"/"+(1+m.date())).then((o)=>{

			// Create ring data, add custom attributes (like queue time)
			var ring_data=[];
			for (let c of o.data){

				if(c.attributes.answered){

					// Compile ring data
					for(let ext of Object.keys(c.attributes.rang)) {
						ring_data.push({"ext": ext, "time": (new Date(c.attributes.answered)-new Date(c.attributes.rang[ext]))/1000});
					}
				}

				// Calculate queue time
				c.attributes.queue_time=null;
				if(c.attributes.enqueued) {
					if(c.attributes.answered) {

						c.attributes.queue_time=(new Date(c.attributes.answered)-new Date(c.attributes.enqueued))/1000;	// Call was enqueued and then answered
					} else {

						if(c.attributes.end && Object.keys(c.attributes.rang).length) {

							c.attributes.queue_time=(new Date(c.attributes.end)-new Date(c.attributes.enqueued))/1000;		// Call was not answered, but rang at least once before it ended
						}				
					}
				}
			}

			// recalculate_thresholds();


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
				.on("renderlet",chart=>draw_bar_labels(chart,(o)=>o.average.toFixed(1)+"s"))
				.render();


			var cf=crossfilter(o.data);
			var day_dim=cf.dimension(c=>(new Date(c.attributes.start)).getDate());
			var day_group=day_dim.group();
			var daily_chart=dc.barChart("#daily")
				.width(640)
				.height(480)
				.margins({top: 10, right: 50, left: 50, bottom: 40})
				.xAxisLabel("January")
				.title((p)=>p.value+" calls")
				.renderTitle(true)
				.dimension(day_dim)
				.group(day_group)
				.x(d3.scale.ordinal().domain(day_group.all().map((o)=>{return o.key;})))
				.xUnits(dc.units.ordinal)
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
			var queue_time_dim=cf.dimension((c) => c.attributes.queue_time);
			var queue_time_group=queue_time_dim.group(v=>(v===null)?-1:(v===0)?10:Math.ceil(v/10)*10);
			var total_queued_calls;
			var queue_time_chart=dc.barChart('#queue_time')
				.width(640)
				.height(480)
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
			["preRender","preRedraw"].forEach(e=>queue_time_chart.on(e,(chart)=>{

				// Recalculate total shown calls and average hold time.
				total_shown_calls=queue_time_dim.top(Infinity).length;
				$("#average_queue_time").text((queue_time_dim.top(Infinity).reduce((p,v)=>p+v.attributes.queue_time,0)/(queue_time_dim.top(Infinity).filter(v=>v.attributes.queue_time!==null).length||1)).toFixed(1));
			}));

			// Clean up axes
			queue_time_chart.yAxis().tickFormat(v=>v*100+"%");
			queue_time_chart.xAxis().tickFormat(v=>(v==-1)?"n/a":v);
			queue_time_chart.render();

			// Setup reset button
			$("#queue_time a.reset")
				.css("display","none") // Change to visibility,hidden in future dc.js releases
				.click(()=>{
					queue_time_chart.filterAll();
					dc.redrawAll();
				});


			// Call Destination
			var extension_dim=cf.dimension((d)=>d.attributes.answered_by||"unanswered");
			var extension_group=extension_dim.group().reduceCount();
			var destination_chart=dc.barChart('#destinations')
				.width(640)
				.height(480)
				.margins({top: 10, right: 50, left: 100, bottom: 100})
				.dimension(extension_dim)
				.group(extension_group)
				.x(d3.scale.ordinal().domain(extension_group.top(Infinity).map((o)=>{return o.key;})))
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

