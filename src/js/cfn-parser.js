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


function parse_cfn_json(json) {
    try {
        var jsonObject = JSON.parse(json);
        // Get relevant top-level items
        var parameters = jsonObject.Parameters;
        var resources = jsonObject.Resources;

        // Set lists
        var nodes = [];
        var edges = [];
        var allRefs = [];
        var allFnSubs = [];
        var allTargets = [];

        // Process parameters
        for(param in parameters) {
            allTargets.push(param);

            nodes.push({
                data: { id: param, type: 'parameter', json: JSON.stringify(parameters[param]) }
            });

        }

        // Process resources
        for(var keyName in resources) {

            var res = resources[keyName];
            allTargets.push(res);


            // Get Refs
            var resRef = traverse(res, get_ref);
            var refEdges = get_edges(keyName, resRef, 'ref');
            edges = edges.concat(refEdges.edges);
            allTargets = allTargets.concat(refEdges.targets);
            allRefs = allRefs.concat(refEdges.targets);

            // Get FnSubs
            var resFnSub = traverse(res, get_fnsub);
            var fnSubEdges = get_edges(keyName, resFnSub, 'fnsub');
            edges = edges.concat(fnSubEdges.edges);
            allTargets = allTargets.concat(fnSubEdges.targets);
            allFnSubs = allFnSubs.concat(fnSubEdges.targets);

            // Get GetAtts
            var resFnGetAtt = traverse(res, get_fngetatt);
            var fnGetAttEdges = get_edges(keyName, resFnGetAtt, 'fngetatt');
            edges = edges.concat(fnGetAttEdges.edges);
            allTargets = allTargets.concat(fnGetAttEdges.targets);



            nodes.push({
                data: {
                    id: keyName,
                    type: 'resource',
                    json: JSON.stringify(res),
                    refs: refEdges.targets.unique1(),
                    fnsubs: fnSubEdges.targets.unique1()
                }
            });
        }

        var pseudo_params = get_pseudo_params();
        for(j = 0; j < pseudo_params.length; j++ ) {
            if(allTargets.includes(pseudo_params[j])) {
                nodes.push({
                    data: { id: pseudo_params[j], type: 'pseudo' }
                });
            }
        }


        nodes = nodes.filter(not_undefined);
        edges = edges.filter(not_undefined);

        return {
            cytoscape: {
                nodes: nodes,
                edges: edges
            },

            graphjs: {

            },
            keys: {
                refs: allRefs,
                fnsub: allFnSubs
            }


        };
    } catch(err) {
        console.error(err);
        return { nodes: undefined, edges: undefined};
    }
}