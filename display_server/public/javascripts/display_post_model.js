// Copyright 2013 Sandia Corporation. Under the terms of Contract DE-AC04-94AL85000, there is a non-exclusive license for use of this work by or on behalf of the U.S. Government. Export of this program may require a license from the United States Government.
var width = 750;
var height = 100000;

var svg = d3.select("body").append ("svg")
            .attr ("width", width)
            .attr ("height", height)
            .attr ("class", "force");

var colorMap = d3.interpolateRgb ("#fff", "#0f0");

d3.json ('/posts',
  function (posts) {
    d3.json ('/users',
      function (users) {
        var nodes = [];
        // for (var u = 0; u < users.length; u ++) {
          for (var p = 0; p < posts.length; p ++) {
            if (posts[p].name == "Rand Paul") {
              nodes.push (posts[p]);
            }
          }
        // }

      var header = svg.append ("g")
        .attr ("class", "head");
      header.selectAll (".header") 
        .data (nodes[0].topic_distribution)
      .enter ().append ("g")
        .attr ("transform", function (d, i) { return "translate(" + (10*i + 53) + ",12)"; })
      .append ("text")
        .text (function (d, i) { return "" + i; })
        .style ("font-size", 8);

      var node = svg.selectAll (".node")
          .data (nodes)
        .enter ().append ("g")
          .attr ("class", "node")
          .attr ("transform", function (d, i) { return "translate(0, " + (11*i+6) + ")"; })
  
      node.selectAll ("rect")
        .data (function (d) { return d.topic_distribution })
      .enter ().append ("rect")
        .attr ("x", function (d, i) { return (i * 10 + 50) + "px"; })
        .attr ("width", 10)
        // .attr ("y", function (d) { return 11 - (d*11); })
        // .attr ("height", function (d) { return (d*11) + "px"; })
        .attr ("y", 11)
        .attr ("height", 11 + "px")
        .style ("fill", function (d) { return colorMap (d); })
        .style ("stroke", "#ddd");

      node.append("text")
        .attr ("y", 25)
        .style ("text-align", "right")
        .text (function (d, i) { return i; });
    });
  });
