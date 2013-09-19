// Copyright 2013 Sandia Corporation. Under the terms of Contract DE-AC04-94AL85000, there is a non-exclusive license for use of this work by or on behalf of the U.S. Government. Export of this program may require a license from the United States Government.
var width = 750;
var height = 750;
var zoom = 2;
var hierarchy_force = 0.001;
var svg = d3.select("body").append ("svg")
            .attr ("width", width)
            .attr ("height", height)
            .attr ("class", "force");


var force = d3.layout.force ()
              .charge(-250)
              .linkDistance(25)
              .gravity(0.20) 
              .size([width, height])

var wcl = d3.select("body").append ("svg")
            .attr ("width", width)
            .attr ("height", height)
            .attr ("class", "bubble");

var bubble = d3.layout.pack ()
               .sort(null)
               .size([width,width])
               .padding(1.5);

var table = d3.select("body").append ("table")
            .attr("border", "1px");

/*
var force = d3.layout.force ()
              .charge(-15)
              .linkDistance(32)
              .size([width, height])
*/

var nodes = new Array ();
var links = new Array ();

var color = d3.scale.category20();
d3.json ('/cluster_model',
  function (model) {
    var len = model.hierarchical.length;
    var init_len = model.initial.length;

    for (var i = 0; i < init_len; i ++) {
      nodes[i] = {"name":"C " + i, "content":[], "posts":[], "isCentroid": true, "group": i, "size": 0, "centroid": model.initial[i]}
    }
    for (var i = init_len; i < len - 1; i ++) {
      nodes[i] = {"name":"P " + i, "content":[], "posts":[], "isParent": true,  "isCentroid": true, "group": -1, "size": 0, "centroid": []}
    }
    nodes[len - 1] = {"name":"P " + (len - 1), "content":"", "posts":[], "isParent": true, "isRoot": true, "isCentroid": true, "group": -1, "centroid": []}

    d3.json ('/posts',
      function (docs) {
        for (var i = 0; i < docs.length; i ++) {
          var cluster = Math.floor (docs[i].cluster_assignment);
          nodes[cluster].posts.push ({"content": docs[i].content, "proximity": docs[i].cluster_proximity, "topics": docs[i].topic_distribution});
          nodes[cluster].size ++;
        }

      var link_ind = 0;
      for (var i = 0; i < len; i ++) {
        var parnt = Math.floor (model.hierarchical[i]);
        if (parnt >= 0) {
          for (var p = 0; p < nodes[i].posts.length; p ++) {
            nodes[parnt].posts.push (nodes[i].posts[p]);
          }
          nodes[parnt].size += nodes[i].size;
          links[link_ind] = {"source":i,"target":parnt,"value":hierarchy_force,"isHierarchy":true};
          link_ind ++;
        }
      }

      d3.json ('/wordcloud',
        function (model) {
          for (var i = 0; i < len; i ++) {
            d = model.dictionaries[i];
            max = 0;
            for (var key in d) {
              if (d[key] > max) {
                max = d[key];
              }
            }
            index = 0;
            for (var key in d) {
              nodes[i].content[index] = {'name': key, 'value': d[key]/max};
              index ++;
            }
          }
  
          update ();
        });
      });
  });

function update (d) {
    force.nodes (nodes)
         .links (links)
         .start ();

    var link = svg.selectAll (".link")
          .data (links)
        .enter()
          .append ("line")
          .attr ("class", "link")
          .style ("stroke", "#999")
          .style ("stroke-opacity", "0.5")
          .style ("stroke-width", "1");

    var node = svg.selectAll (".node")
          .data (nodes)
        .enter().append ("g");

    var circle = node.append ("circle")
        .attr ("class", "node")
        .attr ("r", function (d) { return d.isCentroid ? (d.isParent ? 15 : d.size/15) : 3; })
        .attr ("fill", function (d) { return d.isCentroid ? "#ffffff" : color(d.group); })
        .attr ("stroke", function (d) { return d.isParent ? (d.isRoot ? "#f00" : "#777") : color(d.group); })
        .attr ("stroke-width", function (d) { return d.isCentroid ? 4 : 0; })
        .on("dblclick", function (d) { if (d.isParent) { toggle (d); update (d); } })
        .on("mouseover", function (d) { showWords (d); })
        .call(force.drag);

    var text = node.append ("text")
        .style ("text-anchor", "middle")
        .text (function (d) { return d.name; })
        .call (force.drag);
  
    force.on("tick", function () {
      link.attr("x1", function(d) { return d.source.x; })
          .attr("y1", function(d) { return d.source.y; })
          .attr("x2", function(d) { return d.target.x; })
          .attr("y2", function(d) { return d.target.y; });

      circle.attr ("cx", function (d) { return d.x; })
            .attr ("cy", function (d) { return d.y; });
      text.attr ("x", function (d) { return d.x; })
          .attr ("y", function (d) { return d.y; });
      });
}

function toggle (d) {
  // TODO 
  // recursively find the children of d and map the leaves to d.
  // but save it so that it'll unwrap
  d.fixed = !d.fixed;
}

function showWords (cluster) {
  wcl.remove ();

  wcl = d3.select("body").append ("svg")
            .attr ("width", width)
            .attr ("height", height)
            .attr ("class", "bubble");

  var node = wcl.selectAll (".bubble")
         .data (bubble.nodes ({children: cluster.content}))
      .enter().append ("g")
        .attr("class", "node")
        .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });

    node.append("circle")
      .attr ("r", function (d) { return d.value * 64; })
      .style ("fill-opacity", "0.0")
      .style ("stroke", function (d) { return color(cluster.group); })
      .style ("stroke-opacitory", "0.9")

    node.append("text")
      .attr("dy", ".3em")
      .style("text-anchor", "middle")
      .text(function (d) { return d.name; })
      .attr("transform", function (d) { return "scale(" + d.value * 4 + ")"; });

  table.remove ();
  table = d3.select("body").append("table")
            .attr("border", "1px");

  var format_topics = function (topics) {
    var ret = "";
    for (var i = 0; i < topics.length; i ++) {
      var val = Math.round (topics[i] * 100) / 100;
      ret += "" + val + ",";
    }
    return ret;
  };

  var tr = table.selectAll ("tr")
            .data (cluster.posts)
           .enter().append ("tr")
            .sort (function (a, b) { return b.proximity - a.proximity; })
           .append ("td")
            .text (function (d) { return d.content; })
            .style ("font-size", function (d) { return d.proximity * 16 + "px"; })
           .append ("td")
            .text (function (d) { return "Proximity: " + d.proximity; })
           .append ("td")
            .text (function (d) { return "Topics: " + format_topics (d.topics); })
            .style ("font", "fixed")
           .append ("td")
            .text (function (d) { return "Centrd: " + format_topics (cluster.centroid); })
            .style ("font", "fixed");

}
