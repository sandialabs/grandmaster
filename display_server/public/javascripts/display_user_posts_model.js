// Copyright 2013 Sandia Corporation. Under the terms of Contract DE-AC04-94AL85000, there is a non-exclusive license for use of this work by or on behalf of the U.S. Government. Export of this program may require a license from the United States Government.
var width = 750;
var height = 8000;

var svg = d3.select("body").append ("svg")
            .attr ("width", width)
            .attr ("height", height)
            .attr ("class", "force");

var colorMap = d3.interpolateRgb ("#fff", "#0f0");

d3.json ('/posts',
  function (posts) {
    var max_cluster = 0;
    for (var p = 0; p < posts.length; p ++) {
      var cluster = Math.floor (posts[p].cluster_assignment);
      if (cluster > max_cluster) {
        max_cluster = cluster;
      }
    } 

    d3.json ('/users',
      function (users) {
        var nodes = [];
        for (var u = 0; u < users.length; u ++) {
          var cluster = Math.floor (users[u].cluster_assignment);
          nodes[u] = {"name":users[u].name, "topics":new Array (max_cluster+1), "max":0}
          for (var t = 0; t < max_cluster+1; t ++) {
            nodes[u].topics[t] = 0;
          }
          var total = 0;
          for (var p = 0; p < posts.length; p ++) {
            if (posts[p].name != users[u].name) {
              continue;
            }
            var post_cluster = Math.floor (posts[p].cluster_assignment);
            nodes[u].topics[post_cluster] ++;
            if (nodes[u].topics[post_cluster] > nodes[u].max) {
              nodes[u].max = nodes[u].topics[post_cluster];
            }
          }
          if (nodes[u].max > 0) {
            for (var t = 0; t < nodes[u].topics.length; t ++) {
              nodes[u].topics[t] /= nodes[u].max;
            }
          }
        }

        var header = svg.append ("g")
          .attr ("class", "head");

        header.selectAll (".header") 
          .data (nodes[0].topics)
        .enter ().append ("g")
          .attr ("transform", function (d, i) { return "translate(" + (10*i + 178) + ",12)"; })
        .append ("text")
          .text (function (d, i) { return "" + i; })
          .style ("font-size", 8);

        var node = svg.selectAll (".node")
            .data (nodes)
          .enter ().append ("g")
            .attr ("class", "node")
            .attr ("transform", function (d, i) { return "translate(0, " + (15*i+2) + ")"; })

        node.selectAll ("rect")
          .data (function (d) { return d.topics })
        .enter ().append ("rect")
          .attr ("x", function (d, i) { return (i * 10 + 175) + "px"; })
          .attr ("width", 10)
          // .attr ("y", function (d) { return 25 - (d*23); })
          // .attr ("height", function (d) { return (d*23+1) + "px"; })
          .attr ("y", 15)
          .attr ("height", 15 + "px")
          .style ("fill", function (d) { return colorMap (d); })
          .style ("stroke", "#ddd");

        node.append("text")
          .attr ("y", 25)
          .style ("text-align", "right")
          .text (function (d) { return d.name; });

      });
  });
