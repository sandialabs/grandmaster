// Copyright 2013 Sandia Corporation. Under the terms of Contract DE-AC04-94AL85000, there is a non-exclusive license for use of this work by or on behalf of the U.S. Government. Export of this program may require a license from the United States Government.
var width = 4750;
var height = 2500;
var bubble_size = 1500;
var zoom = 2;
var hierarchy_force = 0.001;
var _id = 0;
var hierarchy_over = 0.0
var hierarchy_ratio = 0.25;
var root;
var svg = d3.select("body").append ("svg")
            // .attr ("width", width)
            // .attr ("height", height)
            .attr("viewBox", "0 0 " + width + " " + height)
            .attr("preserveAspectRatio", "xMidYMid meet")
            .attr ("class", "force");

var user_force = d3.layout.force ()
              .charge(-500)
              .linkDistance(35)
              // .linkDistance(5)
              .linkStrength(function (d) { return d.value; })
              .gravity(0.5) 
              // .gravity(2.5) 
              .size([width*hierarchy_ratio, height])

var tree = d3.layout.cluster()
              .size([height*(1 + hierarchy_over), width*33])

var diagonal = d3.svg.diagonal()
                .projection(function (d) { return [d.y+width*hierarchy_ratio, d.x]; });

var user_diagonal = d3.svg.diagonal().projection(function (d) { return [d.x, d.y]; });

$("#name-search").on("searched", function (e, text) { name_searched (text); });
$("#name-search").on("cleared", function (e) { name_cleared (); });

$("#term-search").on("searched", function (e, text) { term_searched (text); });
$("#term-search").on("cleared", function (e) { term_cleared (); });


/*
var wcl = d3.select("body").append ("svg")
            .attr ("width", bubble_size)
            .attr ("height", bubble_size)
            .attr ("class", "bubble");
*/

var bubble = d3.layout.pack ()
               .sort(null)
               .size([bubble_size,bubble_size])
               .padding(1.5);

var color = d3.scale.category20();
var post_nodes = new Array ();
var post_links = new Array ();
var user_nodes = new Array ();
var user_links = new Array ();


d3.json ('/cluster_model',
  function (model) {
    var len = model.hierarchical.length;
    var init_len = model.initial.length;

    for (var i = 0; i < init_len; i ++) {
      post_nodes[i] = {"name":"C" + i, "content":[], "isCentroid": true, "group": i, "size": 0}
    }
    for (var i = init_len; i < len - 1; i ++) {
      post_nodes[i] = {"name":"P" + i, "content":[], "isParent": true, "children": [], "isCentroid": true, "group": -1, "size": 0}
    }
    post_nodes[len - 1] = {"name":"P" + (len - 1), "content":"", "isParent": true, "children": [], "isCentroid": true, "group": -1, "size": 0}

/*
    d3.json ('/posts',
      function (docs) {
        for (var i = 0; i < docs.length; i ++) {
          var cluster = Math.floor (docs[i].cluster_assignment);
          post_nodes[cluster].size ++;
        }
*/

      // var link_ind = 0;
      for (var i = 0; i < len; i ++) {
        var parnt = Math.floor (model.hierarchical[i]);
        if (parnt >= 0) {
          post_nodes[parnt].children.push (post_nodes[i]);
          post_nodes[parnt].size += post_nodes[i].size;
          // links[link_ind] = {"source":i,"target":parnt,"value":hierarchy_force,"isHierarchy":true};
          // link_ind ++;
        }
      }

      root = post_nodes[len - 1];
      root.x0 = height / 2;
      root.y0 = 0;

      function toggleAll (d) {
        if (d.children) {
          d.children.forEach (toggleAll);
          toggle (d);
        }
      }

      function toggleLeaf (d) {
        if (d.isLeaf) {
          toggle (d);
        }
      }

      // root.children.forEach (toggleAll);
      root.children.forEach (toggleLeaf);
      update (root);

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
              post_nodes[i].content[index] = {'name': key, 'value': d[key]/max};
              index ++;
            }
          }
  
        });
//      });

    d3.json ('/user_cluster_model',
      function (model) {
        var len = model.cluster.length;
        var user_link_ind = 0;
        for (var i = 0; i < len; i ++) {
          user_nodes[i] = {"name":"Cluster " + i, "isCentroid": true, "post_clusters": null, "post_reversed": null, "max_post_cluster": -1, "size": 0, "group": i}
        }
        for (var i = 0; i < len - 1; i ++) {
          for (var j = i + 1; j < len; j ++) {
            if (model.proximities[i][j] > 0.5) {
              user_links[user_link_ind] = {"source":i, "target":j, "value":(model.proximities[i][j])};
              user_link_ind ++;
            }
          }
        }
        d3.json ('/users',
          function (docs) {
            for (var i = 0; i < docs.length; i ++) {
              user_nodes[i + len] = {"name":docs[i].name, "isCentroid": false};
              if (docs[i].cluster_assignment == null) {
                continue;
              }
              var cluster = Math.floor (docs[i].cluster_assignment);

              user_nodes[i + len]["group"] = cluster;
              user_nodes[cluster].size ++;

              user_links[user_link_ind] = {
                  "source":(i + len),
                  "target":cluster,
                  "value":(docs[i].cluster_proximity == 0 ? 0.1 : docs[i].cluster_proximity)};
              user_link_ind ++;

              if (user_nodes[cluster].post_clusters == null) {
                user_nodes[cluster].post_clusters = new Array ();
                user_nodes[cluster].post_reversed = new Array ();

                for (var c = 0; c < docs[i].post_clusters.length; c ++) {
                  user_nodes[cluster].post_clusters[c] = docs[i].post_clusters[c];
                  user_nodes[cluster].post_reversed[c] = docs[i].post_clusters[c];
                }
              } else {
                for (var c = 0; c < docs[i].post_clusters.length; c ++) {
                  user_nodes[cluster].post_clusters[c] += docs[i].post_clusters[c];
                  user_nodes[cluster].post_reversed[c] += docs[i].post_clusters[c];
                }
              }
            }

            // Normalize the links size from users to posts to max 1
            for (var i = 0; i < len; i ++) {
              if (user_nodes[i].post_clusters == null) {
                continue;
              }
              var max = 0;
              var max_index = -1;
              for (var j = 0; j < user_nodes[i].post_clusters.length; j ++) {
                if (user_nodes[i].post_clusters[j] > max) {
                  max = user_nodes[i].post_clusters[j];
                  max_index = j;
                }
              }
              for (var j = 0; j < user_nodes[i].post_clusters.length; j ++) {
                user_nodes[i].post_clusters[j] /= max;
              }
              user_nodes[i].max_post_cluster = max_index; 
            }

            for (var i = 0; i < init_len; i ++) {
              var max = 0;
              for (var j = 0; j < len; j ++) {
                if (user_nodes[j].post_reversed == null) {
                  continue;
                }
                if (user_nodes[j].post_reversed[i] > max) {
                  max = user_nodes[j].post_reversed[i];
                }
              }
              for (var j = 0; j < len; j ++) {
                if (user_nodes[j].post_reversed == null) {
                  continue;
                }
                user_nodes[j].post_reversed[i] /= max;
              }
            }
    

            user_force.nodes (user_nodes)
                .links (user_links)
                .start ();
    
            var link = svg.selectAll (".user_link")
                .data (user_links.filter (function (d) { return (d.source ? d.source.isCentroid : (d.target ? d.target.isCentroid : false)); }))
              .enter()
                .append ("line")
              .attr ("class", "user_link")
              .style ("stroke", "#777")
              .style ("stroke-width", function (d) { return Math.sqrt(d.value) * 5; })
              .style ("stroke-opacity", function (d) { return Math.sqrt(d.value) - .2; });
          
            var node = svg.selectAll (".user")
                .data (user_nodes)
              .enter().append ("g")
                .attr ("class", "user");
  
            var circle = node.append ("circle")
                .attr ("class", "user_node")
                // .attr ("r", function (d) { return d.isCentroid ? d.size : 3; })
                .attr ("r", function (d) { return d.isCentroid ? 10 : 3; })
                .attr ("fill", function (d) { return d.isCentroid ? "#ffffff" : color(d.group); })
                .attr ("stroke", function (d) { return color(d.group); })
                .attr ("stroke-width", function (d) { return d.isCentroid ? 4 : 0; })
                .on ("mouseover", function (d) { showUsersPosts (d, post_nodes); })
                .call(user_force.drag);
    
            var text = node.append ("text")
              .attr ("class", "user_label")
              .style ("text-anchor", "middle")
              .style("font-size", "150%")
              .attr("class", "no_select")
              .text(function (d) { return d.name; })
              .on ("mouseover", function (d) { showUsersPosts (d, post_nodes); })
              .call(user_force.drag);

            user_force.on("tick", function () {
              circle.attr ("cx", function (d) { return d.x; })
                  .attr ("cy", function (d) { return d.y; });
              text.attr ("x", function (d) { return d.x; })
                  .attr ("y", function (d) { return d.y; });
              link.attr ("x1", function (d) { return d.source.x; })
                  .attr ("y1", function (d) { return d.source.y; })
                  .attr ("x2", function (d) { return d.target.x; })
                  .attr ("y2", function (d) { return d.target.y; });
              });

          });
      });
  });

function update (source) {
    var duration = 100;

    var nodes = tree.nodes(root).reverse ();
    nodes.forEach (function (d) { d.y = d.depth * 55; });

    var node = svg.selectAll ("g.node")
          .data (nodes, function (d) { return d.id || (d.id = ++_id); });
        // .enter().append ("g");

    var nodeEnter =
      node.enter().append ("svg:g")
        .attr("class", "node")
        .attr("transform", function (d) { return "translate(" + (source.y0+width*hierarchy_ratio) + "," + (source.x0-height*hierarchy_over) + ")" })
        // .on("click", function (d) { if (d.isParent) { toggle (d); update (d); } })
        .on("mouseover", function (d, i) { showPostsUsers (d); })

    var circle = nodeEnter.append ("circle")
        .attr("r", 1e-6)
        .attr ("fill", function (d) { return d.isCentroid ? "#ffffff" : color(d.group); })
        .attr ("stroke", function (d) { return d.isParent ? "#777" : color(d.group); })
        .attr ("stroke-width", function (d) { return d.isCentroid ? 4 : 0; })
        .on("mouseover", function (d, i) { showPostsUsers (d); })

    var text = nodeEnter.append ("text")
        // .attr("text-anchor", function (d) { return d.children ? "end" : "start"} )
        .style("text-anchor", "start")
        .attr("class", "no_select")
        // .attr("x", function (d) { return d.children ? -10 : 10; })
        .attr("dy", 0)
        .text (function (d, i) { return d.name+":"+d.size; })
        .on("mouseover", function (d, i) { showPostsUsers (d); })

  var nodeUpdate = 
    node.transition()
      .duration (duration)
      .attr("transform", function (d) { return "translate(" + (d.y+width*hierarchy_ratio) + "," + d.x + ")"; });

  nodeUpdate.select("circle")
    .attr ("r", function (d) { return d.children ? 10 : 10; })
    .attr ("fill", function (d) { return d.isCentroid ? "#ffffff" : color(d.group); })
    .style("fill-opacity", function (d) { return (d.children || d._children) ? 1. : 0.25; })
    .attr ("stroke", function (d) { return d.isParent ? "#777" : color(d.group); })
    .attr ("stroke-width", function (d) { return d.isCentroid ? 4 : 0; });

  nodeUpdate.select("text")
    .style("text-anchor", "start")
    .attr("class", "no_select")
    // .attr("x", function (d) { return d.children ? -10 : 10; })
    // .attr("dy", -10)
    .style("fill-opacity", 1);

  var nodeExit = 
    node.exit().transition ()
      .duration (duration)
      .attr("transform", function (d) { return "translate(" + (source.y+width*hierarchy_ratio) + "," + source.x + ")"; })
      .remove ();

  nodeExit.select ("circle")
    .attr ("r", 1e-6);

  nodeExit.select("text")
    .style("fill-opacity", 1e-6);

  var link = svg.selectAll ("path.link")
              .data(tree.links (nodes), function (d) { return d.target.id; });

  link.enter().insert("svg:path", "g")
      .attr("class", "link")
      .attr("d", function(d) {
        var o = {x: source.x0, y: source.y0};
        return diagonal({source: o, target: o});
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
        return diagonal({source: o, target: o});
      })
      .remove();

  // Stash the old positions for transition.
  nodes.forEach(function(d) {
    d.x0 = d.x;
    d.y0 = d.y;
  });

}

function toggle (d) {
  if (d.children) {
    d._children = d.children;
    d.children = null;
  } else {
    d.children = d._children;
    d._children = null;
  }
}

function showWords (cluster) {
  // wcl.remove ();

/*
  wcl = d3.select("body").append ("svg")
            .attr ("width", bubble_size)
            .attr ("height", bubble_size)
            .attr ("class", "bubble");
*/
  var node = svg.selectAll ("g.node");
  node.select("circle")
    .attr ("r", function (d) { return (d.id == cluster.id ? 15 : 10); });

  node.select("text")
    .style ("font-size", function (d) { return (d.id == cluster.id ? "200%" : "100%"); });

  svg.selectAll ("g.bubble").remove ()

  if (cluster == null) {
   return;
  }

  var node = svg.selectAll ("g.bubble")
         .data (bubble.nodes ({children: cluster.content}).filter (function (d) { return !d.children; }));

  var nodeEnter = node.enter().append ("g")
        .attr("class", "bubble")
        .attr("transform", function (d) { return "translate(" + (width-bubble_size+d.x) + "," + d.y + ")"; })

    nodeEnter.append("circle")
      .attr ("r", function (d) { return d.value * 96; })
      .style ("fill-opacity", "0.0")
      .style ("stroke", function (d) { return color(cluster.group); })
      .style ("stroke-opacitory", "0.9")

    nodeEnter.append("text")
      .attr("dy", ".3em")
      .style("text-anchor", "middle")
      .attr("class", "no_select")
      .text(function (d) { return d.name; })
      .attr("transform", function (d) { return "scale(" + d.value * 9 + ")"; });

  var nodeExit = node.exit ().remove ();
}

function showUsersPosts (user, posts) {
  var user_cluster = null;
  if (user.group != null) {
    user_cluster = user_nodes[user.group];
  }

  if (user_cluster != null && user_cluster.isCentroid) {
    if (post_nodes[user_cluster.max_post_cluster]) {
      showWords (post_nodes[user_cluster.max_post_cluster]);
    }

    var labels = svg.selectAll (".user");
    
    labels.select("text")
      .transition ()
      .duration (100)
      .style ("fill-opacity", function (d) { return (d.name == user.name ? 1 : d.group == user_cluster.group ? 0.7 : 0.1); });

    // svg.selectAll (".user_links").remove ()
    var links = svg.selectAll (".user_links")
        .data (user_cluster.post_clusters);

    links.enter ()
        .append ("path")
        .attr ("class", "user_links")
        .attr ("d", function (d, i) {
          var start = {x: user_cluster.x, y: user_cluster.y};
          var end = {x: (posts[i].y ? posts[i].y : posts[i].y0) + width*hierarchy_ratio, 
                     y: (posts[i].x ? posts[i].x : posts[i].x0)};
          return user_diagonal({source: start, target: end});
        })
        // .attr ("x1", user_cluster.x)
        // .attr ("y1", user_cluster.y)
        // .attr ("x2", function (d, i) { return (posts[i].y ? posts[i].y : posts[i].y0) + width*hierarchy_ratio; })
        // .attr ("y2", function (d, i) { return (posts[i].x ? posts[i].x : posts[i].x0); })
        .style ("fill", "none")
        .style ("stroke", "#279")
        .style ("stroke-opacity", function (d) { return d*0.7; })
        .style ("stroke-width", function (d) { return d*6; });

    links.transition()
        .duration(100)
        .attr ("d", function (d, i) {
          var start = {x: user_cluster.x, y: user_cluster.y};
          var end = {x: (posts[i].y ? posts[i].y : posts[i].y0) + width*hierarchy_ratio, 
                     y: (posts[i].x ? posts[i].x : posts[i].x0)};
          return user_diagonal({source: start, target: end});
        })
        .style ("stroke-opacity", function (d) { return d*0.7; })
        .style ("stroke-width", function (d) { return d*6; });

    links.exit ().remove ();
  } 

  if (!user.isCentroid) { 
    svg.selectAll (".user")
      .select("text")
        .style("font-size", function (d) { return (d.name == user.name ? "300%" : "150%"); });
  }
}

function showPostsUsers (cluster) {
  showWords (cluster);

  if (cluster.isParent) {
    return;
  }

  var links = svg.selectAll (".posts_links")
    .data (user_nodes.filter(function (d) { return d.isCentroid; }));

  links.enter ()
    .append ("path")
    .attr ("class", "posts_links")
    .attr ("d", function (d) {
        var start = {x: d.x, y: d.y};
        var end = {x: cluster.y + width*hierarchy_ratio, y: cluster.x};
        return user_diagonal({source: start, target: end});
      })
    .style ("fill", "none")
    .style ("stroke", "#947")
    .style ("stroke-opacity", function (d) { return d.post_reversed ? d.post_reversed[cluster.group]*0.7 : 0; })
    .style ("stroke-width", function (d) { return d.post_reversed ? d.post_reversed[cluster.group]*6 : 0; });

  links.transition()
    .duration(100)
    .attr ("d", function (d) {
        var start = {x: d.x, y: d.y};
        var end = {x: cluster.y + width*hierarchy_ratio, y: cluster.x};
        return user_diagonal({source: start, target: end});
      })
    .style ("stroke-opacity", function (d) { return d.post_reversed ? d.post_reversed[cluster.group]*0.7 : 0; })
    .style ("stroke-width", function (d) { return d.post_reversed ? d.post_reversed[cluster.group]*6 : 0; });

  links.exit ().remove ();
}

function strstr (str1, str2) {
  return str1.indexOf (str2) >= 0;
}

function name_searched (user_name) {
  var lower_name = user_name.toLowerCase ();
  var node = svg.selectAll (".user");
  node.select("circle")
    .attr ("stroke-width", function (d) { return strstr (d.name.toLowerCase(), lower_name) ? 4 : d.isCentroid ? 4 : 0; })
    .attr ("fill", function (d) { return strstr (d.name.toLowerCase(), lower_name) ? "#27f" : d.isCentroid ? "#ffffff" : color(d.group); })
    .attr ("r", function (d) { return strstr (d.name.toLowerCase(), lower_name) ? 16 : (d.isCentroid ? d.size : 3); })
}

function name_cleared () {
  var node = svg.selectAll (".user");
  node.select("circle")
    .attr ("stroke-width", function (d) { return d.isCentroid ? 4 : 0; })
    .attr ("fill", function (d) { return  d.isCentroid ? "#ffffff" : color(d.group); })
    .attr ("r", function (d) { return d.isCentroid ? d.size : 3; })
}


function term_searched (term) {
  var lowerTerm = term.toLowerCase ();
  var max_node = -1;
  var max_weight = 0;
  for (var i = 0; i < post_nodes.length; i ++) {
    if (post_nodes[i].isParent) {
      continue;
    }
    for (var j = 0; j < post_nodes[i].content.length; j ++) {
      if (post_nodes[i].content[j].name.toLowerCase () == lowerTerm &&
          post_nodes[i].content[j].value > max_weight) 
      {
        max_node = i;
        max_weight = post_nodes[i].content[j].value;
      }
    }
  }
  if (max_node >= 0) {
    showPostsUsers (post_nodes[max_node]);
  } else {
    term_cleared ();
  }
}

function term_cleared () {
  svg.selectAll (".posts_links").remove ();
  svg.selectAll ("g.bubble").remove ()
}
