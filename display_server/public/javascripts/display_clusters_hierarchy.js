// Copyright 2013 Sandia Corporation. Under the terms of Contract DE-AC04-94AL85000, there is a non-exclusive license for use of this work by or on behalf of the U.S. Government. Export of this program may require a license from the United States Government.
var m = [20, 120, 20, 120];
var w = 2000 - m[1] - m[3];
var h = 1280 - m[0] - m[2]
var _id = 0;
var root;

var tree = d3.layout.cluster()
              .size([h, w])
              // .separation(function(a, b) { return (a.parent == b.parent ? 1 : 2) / a.depth; });

var pack = d3.layout.pack()
              .size([h, w])
              .value (function (d) { return (d.size); });

var diagonal = d3.svg.diagonal()
                .projection(function (d) { return [d.y, d.x]; });

var radial = d3.svg.diagonal.radial()
                .projection(function (d) { return [d.y, d.x / 180 * Math.PI]; });

var color = d3.scale.category20();

var vis = d3.select("body").append ("svg")
            .attr ("width", w + m[1] + m[3])
            .attr ("height", h + m[0] + m[2])
            .attr ("class", "hierarchy")
          .append("svg:g")
            .attr ("transform", "translate(" + m[3] + "," + m[0] + ")");

d3.json ('/cluster_model',
  function (model) {
    var clusters = new Array ();
    var initLen = model.initial.length;
    var len = model.hierarchical.length;
    for (var i = 0; i < len; i ++) {
      clusters[i] = {"name":"Cluster " + i, "group":i, "leaf": (i < initLen), "children": (i < initLen) ? null : new Array ()};
    }
    for (var i = 0; i < len; i ++) {
      var par = model.hierarchical[i];
      if (par >= 0) {
        clusters[par].children.push (clusters[i]);
      }
    }
    d3.json ('/posts',
      function (docs) {
        for (var i = 0; i < docs.length; i ++) {
          var c = Math.floor (docs[i].cluster_assignment);
          // var post = {"content":docs[i].content, "group": c, "size":1};
          var post = {"content":docs[i].content, "group": c, "size":1};
          // clusters[c].children.push (post);
        }

      root = clusters[len - 1];
      root.x0 = h / 2;
      root.y0 = 0;

      function toggleAll (d) {
        if (d.children) {
          d.children.forEach (toggleAll);
          toggle (d);
        }
      }

      function toggleLeaf (d) {
        if (d.leaf) {
          toggle (d);
        }
      }

      root.children.forEach (toggleLeaf);

      update (root);
     });

  });

function update(source) {
  var duration = d3.event && d3.event.altKey ? 500 : 500;

  var nodes = tree.nodes(root).reverse ();

  nodes.forEach (function (d) { d.y = d.depth * 50; });

  var node = 
    vis.selectAll("g.node")
      .data(nodes, function (d) { return d.id || (d.id = ++_id); });

  var nodeEnter = 
    node.enter().append("svg:g")
      .attr("class", "node")
      .attr("transform", function (d) { return "translate(" + source.y0 + "," + source.x0 + ")"; })
      .on("click", function (d) { if (!d.leaf) { toggle (d); update (d); } });

  nodeEnter.append ("svg:circle")
      .attr("r", 1e-6)
      .style("fill", function (d) { return d.leaf ? "lightsteelblue" : "#000"; })
      .append("title")
        .text(function (d) { return d.content; });

  nodeEnter.append("svg:text")
      .attr("x", function (d) { return d.children ? -10 : 10; })
      .attr("dy", ".35em")
      .attr("text-anchor", function (d) { return d.children ? "end" : "start"} )
      .text(function (d) { return d.name; })
      .style("fill-opacity", 1e-6);

  var nodeUpdate = 
    node.transition()
      .duration (duration)
      .attr("transform", function (d) { return "translate(" + d.y + "," + d.x + ")"; });

  nodeUpdate.select("circle")
    .attr("r", 4.5)
    .style("fill", function (d) { return d.leaf ? "lightsteelblue" : "#000"; })
    .style("fill-opacity", function (d) { return (d.children || d._children) ? 1. : 0.25; });

  nodeUpdate.select("text")
    .attr("text-anchor", function (d) { return d.children ? "end" : "start"} )
    .attr("x", function (d) { return d.children ? -10 : 10; })
    .style("fill-opacity", 1);

  var nodeExit = 
    node.exit().transition ()
      .duration (duration)
      .attr("transform", function (d) { return "translate(" + source.y + "," + source.x + ")"; })
      .remove ();

  nodeExit.select ("circle")
    .attr ("r", 1e-6);

  nodeExit.select("text")
    .style("fill-opacity", 1e-6);

  var link = vis.selectAll ("path.link")
              .data(tree.links (nodes), function (d) { return d.target.id; });

  link.enter().insert("svg:path", "g")
      .attr("class", "link")
      .attr("d", function(d) {
        var o = {x: source.x0, y: source.y0};
        return ((d.leaf) ? radial({souce: o, target: o}) : diagonal({source: o, target: o}));
      })
      .attr("fill", "none")
      .attr("stroke", "#ccc")
      .attr("stroke-width", "1.5px")
    .transition()
      .duration(duration)
      .attr("d", diagonal);

  // Transition links to their new position.
  link.transition()
      .duration(duration)
      .attr("d", diagonal);

  // Transition exiting nodes to the parent's new position.
  link.exit().transition()
      .duration(duration)
      .attr("d", function(d) {
        var o = {x: source.x, y: source.y};
        return ((d.leaf) ? radial({souce: o, target: o}) : diagonal({source: o, target: o}));
      })
      .remove();

  // Stash the old positions for transition.
  nodes.forEach(function(d) {
    d.x0 = d.x;
    d.y0 = d.y;
  });
}

function toggle(d) {
  if (d.children) {
    d._children = d.children;
    d.children = null;
  } else {
    d.children = d._children;
    d._children = null;
  }
}

