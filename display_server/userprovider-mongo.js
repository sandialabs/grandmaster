// Copyright 2013 Sandia Corporation. Under the terms of Contract DE-AC04-94AL85000, there is a non-exclusive license for use of this work by or on behalf of the U.S. Government. Export of this program may require a license from the United States Government.
var Db = require('mongodb').Db
  , Connection = require('mongodb').Connection
  , Server = require('mongodb').Server
  , BSON = require('mongodb').BSON
  , ObjectID = require('mongodb').ObjectID;

UserProvider = function(db, host, post) {
  this.db = new Db (db, new Server (host, post, {auto_connect: true}, {}));
  this.db.open (function(){});
}

UserProvider.prototype.getCollection = function (callback) {
  this.db.collection('users', 
    function(error, user_collection) {
      if (error) {
        callback (error);
      } else {
        callback (null, user_collection);
      }
    });
}

UserProvider.prototype.findAll = function(callback) {
  this.getCollection(
    function(error,user_collection) {
      if (error) {
        callback (error);
      } else {
        user_collection.find ().toArray (
          function(error, result) {
            if (error)
              callback (error);
            else
              callback (null, result);
          });
      }
    });
}

exports.UserProvider = UserProvider;
