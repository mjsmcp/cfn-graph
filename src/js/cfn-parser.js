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


function get_regex_matches(regexp, str) {
    var match, matches = [];

    while ((match = regexp.exec(str)) !== null) {
        matches.push(match);
    }

    return matches;
}


function get_sub_formatted_keys(value) {
    var keys = [];
    var rx3 = /\${([^}]+)}/g;

    var matches = get_regex_matches(rx3,value);
    for(var i = 0; i < matches.length; i++) {
        var matchList = matches[i];
        for(var j = 0; j < matchList.length; j++) {
            if(!rx3.test(matchList[j])) {
                keys.push(matchList[j]);
            }
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
            console.error(typeof(value));
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

function get_conditions(key, value) {
    var conditions =  [];
    if(key === "Fn::If") {
        if(typeof(value) === "object") {
            var conditionName = value[0];
            conditions.push(conditionName);
        }
    } else if(key === "Condition") {
        if(typeof(value) === "string") {
            conditions.push(value);
        }
    }

    return conditions;
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

function process_node(id, type, node) {

    // Get Refs
    var resRef = traverse(node, get_ref);
    var refEdges = get_edges(id, resRef, 'ref');

    // Get FnSubs
    var resFnSub = traverse(node, get_fnsub);
    var fnSubEdges = get_edges(id, resFnSub, 'fnsub');

    // Get GetAtts
    var resFnGetAtt = traverse(node, get_fngetatt);
    var fnGetAttEdges = get_edges(id, resFnGetAtt, 'fngetatt');

    // Get Conditions
    var resConditions = traverse(node, get_conditions);
    var conditionEdges = get_edges(id, resConditions, 'conditional');

    var edges = [];
    edges = edges.concat(refEdges.edges);
    edges = edges.concat(fnSubEdges.edges);
    edges = edges.concat(fnGetAttEdges.edges);
    edges = edges.concat(conditionEdges.edges);
    return {
        data: {
            id: id,
            type: type,
            json: JSON.stringify(node),
            refs: refEdges.targets.unique1(),
            fnsubs: fnSubEdges.targets.unique1(),
            getatts: fnGetAttEdges.targets.unique1(),
            conditions: conditionEdges.targets.unique1(),
            edges: edges
        }
    };

}

function parse_cfn_json(json, filter_options) {
    try {
        var jsonObject = JSON.parse(json);
        // Get relevant top-level items
        var parameters = jsonObject.Parameters;
        var resources = jsonObject.Resources;
        var conditions = jsonObject.Conditions;
        var outputs = jsonObject.Outputs;

        // make GraphJs
        var graphjs = new Graph();
        var gjsVertices = [];
        var gjsEdges = [];

        // Set lists
        var nodes = [];
        var edges = [];

        // Process parameters
        if(parameters !== undefined)
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
        if(resources !== undefined)
            for(var keyName in resources) {
                var resource = process_node(keyName, 'resource', resources[keyName]);
                gjsVertices.push(resource);
            }

        // Process conditions
        if(conditions !== undefined)
            for(var keyName in conditions) {
                var condition = process_node(keyName, 'condition', conditions[keyName]);
                gjsVertices.push(condition);
            }

        // Process Outputs
        if(outputs !== undefined)
            for(var keyName in outputs) {
                var output = process_node(keyName, 'output', outputs[keyName]);
                gjsVertices.push(output);
            }
        // extract edges
        for(var a = 0; a < gjsVertices.length; a++) {
            var vert = gjsVertices[a];

            if(vert.data.edges !== undefined) {
                gjsEdges = gjsEdges.concat(vert.data.edges);
            }
        }




        // check all the existing edges to see if we used any pseudo params
        var pseudo_params = get_pseudo_params();
        var used_pseudo_params = [];
        gjsEdges.filter(function(edge){
            if(pseudo_params.includes(edge.data.target)) {
                used_pseudo_params.push(edge.data.target);
            }

        });
        used_pseudo_params = used_pseudo_params.unique1();

        // add the pseudo params as vertices
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
            var edge = gjsEdges[z];
            var targKey = edge.data.target;

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
            if(filter_options.include_conditions === undefined) { filter_options.include_conditions = true }
            if(filter_options.include_outputs === undefined) { filter_options.include_outputs = true }

            var include_pseudos = filter_options.include_pseudos;
            var include_parameters = filter_options.include_parameters;
            var include_resources = filter_options.include_resources;
            var include_missings = filter_options.include_missings;
            var include_conditions = filter_options.include_conditions;
            var include_outputs = filter_options.include_outputs;
            for(var i = 0; i < gjsVertices.length; i++) {
                var vert = gjsVertices[i];
                if(
                    (vert.data.type === "parameter" && include_parameters) ||
                    (vert.data.type === "pseudo" && include_pseudos) ||
                    (vert.data.type === "resource" && include_resources) ||
                    (vert.data.type === "missing" && include_missings) ||
                    (vert.data.type === "condition" && include_conditions) ||
                    (vert.data.type === "output" && include_outputs)
                ) {
                    filteredVertices.push(vert);
                } else {
                    blacklistVertexKeys.push(vert.data.id);
                }
            }

            for(var j = 0; j < gjsEdges.length; j++) {
                var edge = gjsEdges[j];

                if(!blacklistVertexKeys.includes(edge.data.target) && !blacklistVertexKeys.includes(edge.data.source)) {
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
            console.log("edge: " + edge.data.source + "=>" + edge.data.target);
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

            }


        };


        return retVal;
    } catch(err) {
        console.error(err);
        return { nodes: undefined, edges: undefined};
    }
}

function not_undefined(i) {
    return !(i===undefined);
}