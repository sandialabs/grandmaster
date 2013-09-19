// Copyright 2013 Sandia Corporation. Under the terms of Contract DE-AC04-94AL85000, there is a non-exclusive license for use of this work by or on behalf of the U.S. Government. Export of this program may require a license from the United States Government.

/**
 * Module dependencies.
 */
var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path');

var PostProvider = require('./postprovider-mongo').PostProvider;
var UserProvider = require('./userprovider-mongo').UserProvider;
var ModelProvider = require('./modelprovider-mongo').ModelProvider;

var app = express();

var db = "";
if (process.argv.length >= 3) {
  db = process.argv[2];
} else {
  console.log ("Usage: node app.js [database]");
}

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
	app.use(express.cookieParser());
	app.use(express.session({ secret: 'this-is-a-secret-key-for-project-grandmaster' }));
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(require('stylus').middleware(__dirname + '/public'));
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

userProvider = new UserProvider (db, 'localhost', 27017);

app.get('/users', function (req, res) {
  userProvider.findAll (
    function (error, docs) {
      switch (req.accepts ('html, json')) {
        case 'html':
          res.render ('display_users.jade', {title:'Users', users:docs});
          break;
        case 'json':
          res.json (docs);
          break;
      }
    });
});

postProvider = new PostProvider (db, 'localhost', 27017);

app.get('/posts', function (req, res) {
  if (req.param('user') != null) {
    console.log ("Looking for user " + user);
    postProvider.findUser (req.param('user'),
      function (error, docs) { res.json (docs); });
  } else {
    postProvider.findAll (
      function (error, docs) {
        switch (req.accepts ('html, json')) {
          case 'html':
            res.render ('display_posts.jade', {title:'Posts', posts:docs});
            break;
          case 'json':
            res.json (docs);
            break;
        }
      });
  }
});

modelProvider = new ModelProvider (db, 'localhost', 27017);

app.get('/terms', function (req, res) {
  modelProvider.find ('lda', 
    function (error, model) {
      switch (req.accepts ('html, json')) {
        case 'html':
          res.render ('display_terms.jade', {title:'Terms', terms:model.terms});
          break;
        case 'json':
          res.json (model.terms);
          break;
      }
    });
});

app.get('/topic_model', function (req, res) {
      switch (req.accepts ('html, json')) {
        case 'html':
          res.render ('display_topic_model.jade', {title:'Topic Model'});
          break;
        case 'json':
          modelProvider.find ('topic', function (error, model) {
            res.json (model);
          });
          break;
      }
});

app.get('/phi_matrix', function (req, res) {
  modelProvider.find ('lda',
    function (error, model) {
      res.render ('display_phi_matrix.jade', {title:'Phi Matrix', phi: model.phi});
    });
});

app.get('/cluster_model', function (req, res) {
  modelProvider.find ('phc',
    function (error, model) {
      switch (req.accepts ('html, json')) {
        case 'html':
          res.render ('display_clusters.jade', 
            {title:'Clusters', clusters:model.initial, hierarchy:model.hierarchical});
          break;
        case 'json':
          res.json (model);
          break;
      } 
    });
});

app.get('/cluster_model_force', function (req, res) {
  res.render ('display_clusters_force.jade', {title:'Clusters'});
});

app.get('/hierarchy', function (req, res) {
  res.render ('display_hierarchy.jade', {title:'Clusters'});
});

app.get('/user_topic_model', function (req, res) {
  modelProvider.find ('upc',
    function (error, model) {
      switch (req.accepts ('html, json')) {
        case 'html':
          res.render ('display_user_model.jade', 
            {title:'User Model', clusters:model.cluster});
          break;
        case 'json':
          res.json (model);
          break;
      } 
    });
});

app.get('/post_topic_model', function (req, res) {
  modelProvider.find ('upc',
    function (error, model) {
      switch (req.accepts ('html, json')) {
        case 'html':
          res.render ('display_post_model.jade', 
            {title:'Posts Model', clusters:model.cluster});
          break;
        case 'json':
          res.json (model);
          break;
      } 
    });
});

app.get('/post_cluster_topics', function (req, res) {
  modelProvider.find ('upc',
    function (error, model) {
      switch (req.accepts ('html, json')) {
        case 'html':
          res.render ('display_post_cluster_topics.jade', 
            {title:'Posts Model', clusters:model.cluster});
          break;
        case 'json':
          res.json (model);
          break;
      } 
    });
});

app.get('/user_posts_model', function (req, res) {
  modelProvider.find ('upc',
    function (error, model) {
      switch (req.accepts ('html, json')) {
        case 'html':
          res.render ('display_user_posts_model.jade', 
            {title:'User Posts Model', clusters:model.cluster});
          break;
        case 'json':
          res.json (model);
          break;
      } 
    });
});

app.get('/user_cluster_topics', function (req, res) {
  modelProvider.find ('upc',
    function (error, model) {
      switch (req.accepts ('html, json')) {
        case 'html':
          res.render ('display_user_cluster_topics.jade', 
            {title:'User Model', clusters:model.cluster});
          break;
        case 'json':
          res.json (model);
          break;
      } 
    });
});

app.get('/user_cluster_model', function (req, res) {
  modelProvider.find ('upc',
    function (error, model) {
      switch (req.accepts ('html, json')) {
        case 'html':
          res.render ('display_user_clusters.jade', 
            {title:'User Clusters', clusters:model.cluster});
          break;
        case 'json':
          res.json (model);
          break;
      } 
    });
});

app.get('/complete_model', function (req, res) {
  res.render ('display_full_model.jade', {title:'Project Grandmaster'});
});

app.get('/wordcloud', function (req, res) {
  modelProvider.find ('wordCloud',
    function (error, model) {
      switch (req.accepts ('json')) {
        case 'json':
          res.json (model);
          break;
      } 
    });
});

require('./router')(app);

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
