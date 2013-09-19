// Copyright 2013 Sandia Corporation. Under the terms of Contract DE-AC04-94AL85000, there is a non-exclusive license for use of this work by or on behalf of the U.S. Government. Export of this program may require a license from the United States Government.
var width = 2000;
var height = 1500;
var zoom = 2;
var svg = d3.select("body").append ("svg")
            .attr ("width", width)
            .attr ("height", height)
            .attr ("class", "force");

var force = d3.layout.force ()
              .charge(-300)
              .linkDistance(32)
              .size([width, height])

var color = d3.scale.category20();

d3.json ('/user_cluster_model',
  function (model) {
    var nodes = new Array ();
    var links = new Array ();
    var len = model.cluster.length;
    for (var i = 0; i < len; i ++) {
      nodes[i] = {"name":"Cluster " + i, "isCentroid": true, "group": i}
    }
    d3.json ('/users',
      function (docs) {
        for (var i = 0; i < docs.length; i ++) {
          var cluster = Math.floor (docs[i].cluster_assignment);
          nodes[i + len] = {"name":docs[i].name, "isCentroid": false, "group": cluster};
          links[i] = {"source":(i + len),"target":cluster,"value":1};
        }

        force.nodes (nodes)
             .links (links)
             .start ();

        var node = svg.selectAll (".node")
            .data (nodes)
          .enter().append ("g");

        var circle = node.append ("circle")
            .attr ("class", "node")
            .attr ("r", function (d) { return d.isCentroid ? 32 : 3; })
            .attr ("fill", function (d) { return d.isCentroid ? "#ffffff" : color(d.group); })
            .attr ("stroke", function (d) { return color(d.group); })
            .attr ("stroke-width", function (d) { return d.isCentroid ? 4 : 0; })
            .call(force.drag);

        var text = node.append ("text")
            .style ("text-anchor", "middle")
            .text(function (d) { return d.name; })
            .call(force.drag);
        
        force.on("tick", function () {
          circle.attr ("cx", function (d) { return d.x; })
                .attr ("cy", function (d) { return d.y; });
          text.attr ("x", function (d) { return d.x; })
              .attr ("y", function (d) { return d.y; });
          });
      });
  });
