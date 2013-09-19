// Copyright 2013 Sandia Corporation. Under the terms of Contract DE-AC04-94AL85000, there is a non-exclusive license for use of this work by or on behalf of the U.S. Government. Export of this program may require a license from the United States Government.

$("#name-search").on("searched", function (e, text) { fill_user_info (text); });
$("#name-search").on("cleared", function (e) { clear_user_info (); });

function replaceURLWithHTMLLinks(text) {
    var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(exp,"<a href='$1'>$1</a>"); 
}

function clear_user_info () {
  $("#my_content").empty ();
  $("#nearest_content").empty ();
  $("#central_content").empty ();
  $("#link_content").empty ();
}

function fill_user_info (user_name) {
  clear_user_info ();

  d3.json ('/users',
    function (users) {
      var myUser = null;
      for (var i = 0; i < users.length; i ++) { 
        if (users[i].name == user_name) {
          myUser = users[i];
        }
      }

      function cosCompare (a, b) {
        if (a.length != b.length) {
          return 0;
        }
        var sum_ab = 0;
        var sum_a = 0;
        var sum_b = 0;
        for (var i = 0; i < a.length; i ++) {
          sum_ab += a[i] * b[i];
          sum_a += a[i] * a[i];
          sum_b += b[i] * b[i];
        }
        return sum_ab / (Math.sqrt(sum_a) * Math.sqrt(sum_b));
      }

      users.sort (function (a, b) {
        var a_del = cosCompare (myUser.post_clusters, a.post_clusters);
        var b_del = cosCompare (myUser.post_clusters, b.post_clusters);
        return b_del - a_del;
      });

      var nearest = null;
      var nearest_del = 0;
      var central = null;
      for (var i = 0; i < users.length; i ++) {
        if (Math.floor(users[i].cluster_assignment) == Math.floor (myUser.cluster_assignment)) 
        {
          var del = cosCompare(myUser.post_clusters, users[i].post_clusters);
          if (users[i].name != user_name && (nearest == null || del > nearest_del)) {
            nearest = users[i];
            nearest_del = del;
          }

          if (central == null || users[i].cluster_proximity > central.cluster_proximity) {
            central = users[i];
          }
        }
      }

      var $mine = $("<p class=text-center>"+user_name+"</p>");
      $mine.appendTo("#my_content");

      var $nearest = $("<p class=text-center>"+nearest.name+"</p>");
      $nearest.appendTo("#nearest_content");

      var $central = $("<p class=text-center>"+central.name+"</p>");
      $central.appendTo("#central_content");

      var http_data = [];
      d3.json ('/posts?user='+user_name, function (posts) {
        for (var i = 0; i < posts.length; i ++) {
          var $newElement = $("<p>" + posts[i].content + "</p>");
          $newElement.appendTo("#my_content");
        }
      });
      d3.json ('/posts?user='+nearest.name, function (posts) {
        for (var i = 0; i < posts.length; i ++) {
          var $newElement = $("<p>" + posts[i].content + "</p>");
          $newElement.appendTo("#nearest_content");
        }
      });
      d3.json ('/posts?user='+central.name, function (posts) {
        for (var i = 0; i < posts.length; i ++) {
          var $newElement = $("<p>" + posts[i].content + "</p>");
          $newElement.appendTo("#central_content");
        }
      });

      for (var j = 0; j < users.length; j ++) {
        if (Math.floor(users[j].cluster_assignment) != Math.floor (myUser.cluster_assignment)
            || users[j].name == user_name) 
        {
          continue;
        }
        d3.json ('/posts?user='+users[j].name, function (posts) {
          for (var i = 0; i < posts.length; i ++) {
            if (posts[i].content.indexOf ("http") >= 0)
            {
              var $newElement = $("<p>" + posts[i].name + ": " + replaceURLWithHTMLLinks(posts[i].content) + "</p>");
              $newElement.appendTo("#link_content");
            }
          }
        });
      }

      $("body").css("overflow", "visible");
    });
}
