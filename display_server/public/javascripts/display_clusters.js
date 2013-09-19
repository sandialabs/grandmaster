
// Copyright 2013 Sandia Corporation. Under the terms of Contract DE-AC04-94AL85000, there is a non-exclusive license for use of this work by or on behalf of the U.S. Government. Export of this program may require a license from the United States Government.

var width = 2000;
var height = 1500;
var zoom = 2;
var svg = d3.select("body").append ("svg")
            .attr ("width", width)
            .attr ("height", height)
            .attr ("class", "force");

var force = d3.layout.force ()
              .charge(-15)
              .linkDistance(32)
              .size([width, height])

var color = d3.scale.category20();
d3.json ('/cluster_model',
  function (model) {
    var nodes = new Array ();
    var links = new Array ();
    var len = model.initial.length;
    var link_ind = 0;
    for (var i = 0; i < len; i ++) {
      nodes[i] = {"name":"Cluster " + i, "content":"", "isCentroid": true, "group": i}
    }
    for (var i = 0; i < len - 1; i ++) {
      for (var j = i + 1; j < len; j ++) {
        if (model.proximities[i][j] > (10.0 / len)) {
          // links[link_ind] = {"source":i, "target":j, "value":(model.proximities[i][j] / 500.0)};
          // link_ind ++;
        }
      }
    }
    d3.json ('/posts',
      function (docs) {
        for (var i = 0; i < docs.length; i ++) {
          var cluster = Math.floor (docs[i].cluster_assignment);
          nodes[i + len] = {"name":"", "content":docs[i].content, "isCentroid": false, "group": cluster};
          links[link_ind] = {"source":(i + len),"target":cluster,"value":1};
          link_ind ++;
        }
  
        force.nodes (nodes)
             .links (links)
             .start ();

        var node = svg.selectAll (".node")
              .data (nodes)
            .enter().append ("g");

        function click(d) {
          if (d.isCentroid) {
            this.fixed = !this.fixed;
          }
        }

        var circle = node.append ("circle")
            .attr ("class", "node")
            .attr ("r", function (d) { return d.isCentroid ? 32 : 3; })
            .attr ("fill", function (d) { return d.isCentroid ? "#ffffff" : color(d.group); })
            .attr ("stroke", function (d) { return color(d.group); })
            .attr ("stroke-width", function (d) { return d.isCentroid ? 4 : 0; })
            .on("click", click)
            .call(force.drag);

        var text = node.append ("text")
            .style ("text-anchor", "middle")
            .text (function (d) { return d.name; })
            .call (force.drag);
  
        circle.append ("title")
            .text(function (d) { return d.content; })
        
        force.on("tick", function () {
          circle.attr ("cx", function (d) { return d.x; })
                .attr ("cy", function (d) { return d.y; });
          text.attr ("x", function (d) { return d.x; })
              .attr ("y", function (d) { return d.y; });
          });
      });
  });
