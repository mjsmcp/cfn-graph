/**
 * Created by mjsmcp on 9/16/17.
 */
// https://stackoverflow.com/questions/722668/traverse-all-the-nodes-of-a-json-object-tree-with-javascript
//called with every property and its value
function get_ref(key,value) {
    var refs = [];
    if(key === "Ref") {
        refs.push(value);
    }
    return refs;
}

// incomplete
function get_sub_formatted_keys(value) {
    var keys = [];
    var rx3 = /\${([^}]+)}/;
    var matches = value.match(rx3);
    if (!(matches === null)) {

        var validMatches = [];
        for (var i = 0; i < matches.length; i++) {
            if (!rx3.test(matches[i])) {
                validMatches.push(matches[i]);
            }
        }

        validMatches = validMatches.unique1();
        for (var k = 0; k < validMatches.length; k++) {
            keys.push(validMatches[k]);
        }
    }

    return keys;
}
function get_fnsub(key,value) {
    var subs = [];
    if(key === "Fn::Sub") {
        if(typeof(value) === "string") {
            subs = subs.concat(get_sub_formatted_keys(value));

        } else if(typeof(value) === "object") {
            var string = value[0];
            var obSubs = get_sub_formatted_keys(string);

            var objKeys = value[1];

            var objKeyNames = [];
            for(var objKey in objKeys) {
                objKeyNames.push(objKey);
            }

            obSubs = obSubs.filter(function(item) {
                return !objKeyNames.includes(item);
            });

            subs = subs.concat(obSubs);

        } else {
            console.log(typeof(value));
        }



    }
    return subs;
}

function get_fngetatt(key, value) {
    var getatts = [];
    if(key === "Fn::GetAtt") {
        if(typeof(value) === "string") {
            var first = value.split(".")[0];
            getatts.push(first);
        } else if(typeof(value) === "object") {
            var arrayFirst = value[0];
            getatts.push(arrayFirst);
        }
    }
    return getatts;
}

function print(key,value) {
    console.log(key + " : " + value);
}





function traverse(o,func) {
    var items = [];
    for (var i in o) {
        items = items.concat(func.apply(this,[i,o[i]]));
        if (o[i] !== null && typeof(o[i])==="object") {
            //going one step down in the object tree!!
            items = items.concat(traverse(o[i],func));
        }
    }

    return items;
}


function get_pseudo_params() {
    return [
        "AWS::AccountId",
        "AWS::NotificationARNs",
        "AWS::NoValue",
        "AWS::Region",
        "AWS::StackId",
        "AWS::StackName",
        "AWS::Partition",
        "AWS::Region",
        "AWS::StackId",
        "AWS::StackName",
        "AWS::URLSuffix"
    ];
}


function get_edges(source, targets, type) {

    // List Targets
    var targetStrings = [];
    for(var i = 0; i < targets.length; i++) {
        targetStrings.push(targets[i]);
    }


    // Dedup Targets
    targetStrings = targetStrings.unique1();

    // Create edges
    var edges = [];
    for(var k = 0; k < targetStrings.length; k++) {
        var edge = { // edge ab
            data: {
                id: source + ">" + targetStrings[k],
                source: source,
                target: targetStrings[k],
                type: type
            }
        };
        edges.push(edge);
    }

    return {
        edges: edges,
        targets: targetStrings
    };
}


function parse_cfn_json(json, filter_options) {
    try {
        var jsonObject = JSON.parse(json);
        // Get relevant top-level items
        var parameters = jsonObject.Parameters;
        var resources = jsonObject.Resources;

        // make GraphJs
        var graphjs = new Graph();
        var gjsVertices = [];
        var gjsEdges = [];

        // Set lists
        var nodes = [];
        var edges = [];
        var allRefs = [];
        var allFnSubs = [];
        var allTargets = [];
        var allFnGetAtts = [];

        // Process parameters
        for(param in parameters) {
            gjsVertices.push({
                data: {
                    id: param,
                    type: 'parameter',
                    json: JSON.stringify(parameters[param])
                }

            });
        }

        // Process resources
        for(var keyName in resources) {
            var res = resources[keyName];

            // Get Refs
            var resRef = traverse(res, get_ref);
            var refEdges = get_edges(keyName, resRef, 'ref');
            for(var i = 0; i < refEdges.edges.length; i++) {
                var edge = refEdges.edges[i];
                gjsEdges.push(edge);
            }
            allRefs = allRefs.concat(refEdges.targets);

            // Get FnSubs
            var resFnSub = traverse(res, get_fnsub);
            var fnSubEdges = get_edges(keyName, resFnSub, 'fnsub');
            for(var i = 0; i < fnSubEdges.edges.length; i++) {
                var edge = fnSubEdges.edges[i];
                gjsEdges.push(edge);
            }
            allFnSubs = allFnSubs.concat(fnSubEdges.targets);

            // Get GetAtts
            var resFnGetAtt = traverse(res, get_fngetatt);
            var fnGetAttEdges = get_edges(keyName, resFnGetAtt, 'fngetatt');
            for(var i = 0; i < fnGetAttEdges.edges.length; i++) {
                var edge = fnGetAttEdges.edges[i];
                gjsEdges.push(edge);
            }
            allFnGetAtts = allFnGetAtts.concat(fnGetAttEdges.targets);


            gjsVertices.push(
                {
                    data: {
                        id: keyName,
                        type: 'resource',
                        json: JSON.stringify(res),
                        refs: refEdges.targets.unique1(),
                        fnsubs: fnSubEdges.targets.unique1(),
                        getatts: fnGetAttEdges.targets.unique1()
                    }
                }
            );
        }



        var pseudo_params = get_pseudo_params();
        var used_pseudo_params = [];
        gjsEdges.filter(function(edge){
            if(pseudo_params.includes(edge.data.target)) {
                used_pseudo_params.push(edge.data.target);
            }

        });

        used_pseudo_params = used_pseudo_params.unique1();


        for(j = 0; j < used_pseudo_params.length; j++ ) {
            var used_pp = used_pseudo_params[j];
            gjsVertices.push(
                {
                    data: { id: used_pp, type: 'pseudo' }
                }
            );
        }

        // find broken edges
        var vertexKeys = [];
        for(var y = 0; y < gjsVertices.length; y++) {
            vertexKeys.push(gjsVertices[y].data.id);
        }

        var vertexNotExistsErrors = [];
        for(var z = 0; z < gjsEdges.length; z++) {
            var targKey = gjsEdges[z].data.target;

            if(!vertexKeys.includes(targKey)) {
                gjsVertices.push(
                    {
                        data: {
                            id: targKey,
                            type: 'missing'
                        }
                    }
                );
                vertexNotExistsErrors.push(
                    {
                        source: edge.data.source,
                        target: targKey
                    }
                );
            }
        }


        // apply filter options

        var filteredVertices = [];
        var blacklistVertexKeys = [];
        var filteredEdges = [];
        if(filter_options !== undefined) {

            if(filter_options.include_pseudos === undefined) { filter_options.include_pseudos = true }
            if(filter_options.include_parameters === undefined) { filter_options.include_parameters = true }
            if(filter_options.include_resources === undefined) { filter_options.include_resources = true }
            if(filter_options.include_missings === undefined) { filter_options.include_missings = true }

            var include_pseudos = filter_options.include_pseudos;
            var include_parameters = filter_options.include_parameters;
            var include_resources = filter_options.include_resources;
            var include_missings = filter_options.include_missings;

            for(var i = 0; i < gjsVertices.length; i++) {
                var vert = gjsVertices[i];
                if(
                    (vert.data.type === "parameter" && include_parameters) ||
                    (vert.data.type === "pseudo" && include_pseudos) ||
                    (vert.data.type === "resource" && include_resources) ||
                    (vert.data.type === "missing" && include_missings)
                ) {
                    filteredVertices.push(vert);
                } else {
                    blacklistVertexKeys.push(vert.data.id);
                }
            }

            for(var j = 0; j < gjsEdges.length; j++) {
                var edge = gjsEdges[j];

                if(!blacklistVertexKeys.includes(edge.data.target)) {
                    filteredEdges.push(edge);
                }
            }
        } else {
            filteredVertices = gjsVertices;
            filteredEdges = gjsEdges;
        }



        // add vertices
        for(var vertI = 0; vertI < filteredVertices.length; vertI++) {
            var vertex = filteredVertices[vertI];
            nodes.push(vertex);
            graphjs.addVertex(vertex.data.id, vertex);

        }

        // add edges

        for(var edgeI = 0; edgeI < filteredEdges.length; edgeI++) {
            var edge = filteredEdges[edgeI];
            edges.push(edge);
                graphjs.addEdge(edge.data.source, edge.data.target, edge);
        }

        var parseValid = true;
        if(vertexNotExistsErrors.length !== 0) {
            parseValid = false;
        }







        // get cycles
        var cycles = Array.from(graphjs.cycles());
        var retVal = {
            isValid: parseValid,

            cytoscape: {

                nodes: nodes,
                edges: edges
            },

            graphjs: graphjs,

            analysis: {
                nodeCount: graphjs.vertexCount(),
                edgeCount: graphjs.edgeCount(),
                badEdges: vertexNotExistsErrors,
                cycles: cycles

            },
            keys: {
                refs: allRefs,
                fnsub: allFnSubs,
                fngetatt: allFnGetAtts
            }


        };

        console.log(retVal);

        return retVal;
    } catch(err) {
        console.error(err);
        return { nodes: undefined, edges: undefined};
    }
}

function not_undefined(i) {
    return !(i===undefined);
}