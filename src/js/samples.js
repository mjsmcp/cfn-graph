function load_template(id) {

    var url = "";
    switch(id) {
        case "tableau-cluster":
            url = "public-sample-ssl-cluster.cfn";
            break;
        case "vpc-dns":
            url = "VPC_With_PublicIPs_And_DNS.template";
            break;
        case "elb-autoscaling":
            url = "ELBGuidedAutoScalingRollingUpgrade.template";
            break;
    }

    if(url === "") {
        return;
    }


    $.ajax({
        url: "templates/" + url,
        success: function(data) {
            $("#input_cfn").val(data);
            handle_json_change();
        }
    });
}