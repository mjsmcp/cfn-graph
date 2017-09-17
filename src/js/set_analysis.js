/**
 * Created by mjsmcp on 9/16/17.
 */
function set_analysis(analysis) {
    $("#graphNodeCount").html(analysis.nodeCount);
    $("#graphEdgeCount").html(analysis.edgeCount);


    var cycleDisplay = "";
    if(analysis.cycles.length === 0) {
        cycleDisplay = "No cycles found";
    } else {
        for(var j = 0; j < analysis.cycles.length; j++) {
            var cycle = analysis.cycles[j];
            cycleDisplay +="<div class='cycle'>";
            for(var k = 0; k < cycle.length; k++) {
                cycleDisplay += cycle[k];
                if(k !== cycle.length-1) {
                    cycleDisplay += " => ";
                }
            }
            cycleDisplay += "</div>";
        }
    }
    $("#graphCycles").html(cycleDisplay);


    var brokenEdgesDisplay = "";
    if(analysis.badEdges.length === 0) {
        brokenEdgesDisplay = "No broken edges";
    } else {
        brokenEdgesDisplay += "<table><tr><th>Source</th><th>Target</th></tr>";
        for(var i = 0; i < analysis.badEdges.length; i++) {
            var badEdge = analysis.badEdges[i];
            brokenEdgesDisplay += "<tr><td>" + badEdge.source + "</td>" +
                    "<td>" + badEdge.target + "</td></tr>";
        }
        brokenEdgesDisplay += "</table>";
    }
    $("#graphBrokenEdges").html(brokenEdgesDisplay);
}