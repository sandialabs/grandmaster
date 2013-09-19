// Copyright 2013 Sandia Corporation. Under the terms of Contract DE-AC04-94AL85000, there is a non-exclusive license for use of this work by or on behalf of the U.S. Government. Export of this program may require a license from the United States Government.

var Db = require('mongodb').Db
  , MongoClient = require('mongodb').MongoClient
  , Connection = require('mongodb').Connection
  , Server = require('mongodb').Server
  , BSON = require('mongodb').pure().BSON
  , ObjectID = require('mongodb').ObjectID
  , GridStore = require('mongodb').GridStore
  , Grid = require('mongodb').Grid;

ModelProvider = function(db, host, post) {
  this.db = new Db (db, new Server (host, post, {auto_connect: true}, {}));
  this.db.open (function(){});
  this.grid = new Grid (this.db, 'fs');
}

ModelProvider.prototype.getCollection = function (callback) {
  this.db.collection('models',
    function(error, model_collection) {
      if (error) {
        callback (error);
      } else {
        callback (null, model_collection);
      }
    });
}

ModelProvider.prototype.find = function (modelName, callback) {
  var grid = this.grid;
  
  this.getCollection(
    function (error, model_collection) {
      if (error) {
        callback (error);
      } else {
        model_collection.findOne ({'model' : modelName}, 
          function (error, result) {
            if (error) {
              callback (error);
            } else {
/*
              if (modelName == 'lda') {
                // process the grid data
                grid.get (result.phi, function (e, d) {
                  result.phi = eval (d);
                  grid.get (result.theta, function (e, d) {
                    result.theta = eval (d);
                    grid.get (result.terms, function (e, d) {
                      result.terms = eval (d);
                      callback (null, result);
                    });
                  });
                });
              } else {
*/
                callback (null, result);
//              }
            }
          });
      }
    });
};

exports.ModelProvider = ModelProvider;

