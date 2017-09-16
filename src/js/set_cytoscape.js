/**
 * Created by mjsmcp on 9/16/17.
 */
function set_cytoscape(nodes, edges, node_click) {
    console.log("Nodes:");
    console.log(nodes);

    console.log("Edges:");
    console.log(edges);


    var cy = cytoscape({

        container: document.getElementById('cy'), // container to render in

        elements: nodes.concat(edges),

        style:  cytoscape.stylesheet()
            .selector('node')
            .css({
                'label': 'data(id)',
                'background-fit': 'cover',
                'background-color': '#666',
                'border-width': 0

            })
            .selector("[type = 'pseudo']")
            .css({
                'label': 'data(id)',
                'background-fit': 'cover',
                'background-color': '#66f',
                'border-width': 0

            })
            .selector("[type = 'parameter']")
            .css({
                'label': 'data(id)',
                'background-fit': 'cover',
                'background-color': '#6f6',
                'border-width': 0

            })
            .selector("[type = 'resource']")
            .css({
                'label': 'data(id)',
                'background-fit': 'cover',
                'background-color': '#f66',
                'border-width': 0

            })
            .selector('edge')
            .css({
                'curve-style': 'bezier',
                'width': 3,
                'target-arrow-shape': 'triangle',
                'line-color': '#ffaaaa',
                'target-arrow-color': '#ffaaaa'
            })
            .selector("[ type = 'fnsub' ]")
            .css({
                'curve-style': 'bezier',
                'width': 3,
                'target-arrow-shape': 'triangle',
                'line-color': '#aaffaa',
                'target-arrow-color': '#aaffaa'
            })
            .selector("[ type = 'fngetatt' ]")
            .css({
                'curve-style': 'bezier',
                'width': 3,
                'target-arrow-shape': 'triangle',
                'line-color': '#aaaaff',
                'target-arrow-color': '#aaaaff'
            }),

        layout: {
            name: 'springy',
            avoidOverlap: true,
            nodeDimensionsIncludeLabels: true,

            animate: true, // whether to show the layout as it's running
            maxSimulationTime: 40000, // max length in ms to run the layout
            ungrabifyWhileSimulating: false, // so you can't drag nodes during layout
            fit: false, // whether to fit the viewport to the graph
            padding: 20, // padding on fit
            boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
            randomize: false, // whether to use random initial positions
            infinite: false, // overrides all other options for a forces-all-the-time mode
            ready: undefined, // callback on layoutready
            stop: undefined, // callback on layoutstop

            // springy forces and config
            stiffness: 100,
            repulsion: 600,
            damping: 0.4,
            edgeLength: function( edge ){
                var length = edge.data('length');

                if( length !== undefined && !isNaN(length) ){
                    return length;
                }
            }
        }

    })
        .on('click','node', node_click);




}
