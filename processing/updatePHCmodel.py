#!/usr/bin/env python

#Copyright 2013 Sandia Corporation. Under the terms of Contract DE-AC04-94AL85000, there is a non-exclusive license for use of this work by or on behalf of the U.S. Government. Export of this program may require a license from the United States Government.

import pymongo
import gridfs
import pickle

import sys, string, time
import unicodedata
import datetime

from vtk import *
from titan.TextAnalysis import *
from titan.DataAnalysis import *
from titan.MachineLearning import *

from optparse import OptionParser
parser = OptionParser ()
parser.add_option ("-d", "--db", dest="database",
                   help="Specify the mongo database to work with")
parser.add_option ("-k", "--clusters", dest="clusters", type="int", default=15,
                help="Specify the number of clusters to find at the base of the hierarchy (default: 15)")
(options, args)  = parser.parse_args ()

if (options.database == None):
  print "You must specify a database.  Use -h for help"
  exit ();

connection = pymongo.Connection ()
db = connection[options.database]
fs = gridfs.GridFS(db)

posts = db['posts']
models = db['models']
ldaModel = models.find_one({'model' : 'lda'})

rows = posts.count ()
print "rows " + str(rows)
if (rows <= 0):
  print "No posts to process"
  exit()

columns = ldaModel['topics']
print "columns " + str(columns)

thetaTable = vtkTable ()
for i in range(0, columns):
  column = vtkDoubleArray ()
  column.SetName (str(i))
  for post in posts.find ():
    try:
      column.InsertNextValue (post['topic_distribution'][i])
    except:
      column.InsertNextValue (0)
  thetaTable.AddColumn (column)

cluster = vtkPHClustering ()
cluster.SetInputData (thetaTable)
cluster.SetNumberOfClusters (options.clusters)
cluster.SetNumberOfTrials (10)
print "Processing PHC"
cluster.Update ()

print "finished"
initialTable = cluster.GetOutput (0)
hierarchicalTable = cluster.GetOutput (1)
assignmentTable = cluster.GetOutput (2)

aArr = assignmentTable.GetColumn (0);
assignmentsPython = [
    [ aArr.GetComponent (i, j) for j in range (0, aArr.GetNumberOfComponents ()) ] 
  for i in range (0, aArr.GetNumberOfTuples ()) ]

apArr = assignmentTable.GetColumn (1);
assignmentProxPython = [
    [ apArr.GetComponent (i, j) for j in range (0, apArr.GetNumberOfComponents ()) ] 
  for i in range (0, apArr.GetNumberOfTuples ()) ]

doc = 0

for post in posts.find ():
  if (doc >= len(assignmentsPython)):
    break
  post['cluster_assignment'] = assignmentsPython[doc]
  post['cluster_proximity'] = assignmentProxPython[doc]
  posts.update ({'_id' : post['_id']}, post)
  doc = doc + 1

if (doc != len(assignmentsPython)):
  print "Error assignments and posts don't match"
  exit ()

iArr = initialTable.GetColumn (0);

initialClusters = [ 
    [ iArr.GetComponent (i, j) for j in range (0, iArr.GetNumberOfComponents ()) ] 
  for i in range (0, iArr.GetNumberOfTuples ()) ]

hArr = hierarchicalTable.GetColumn (0);
pArr = hierarchicalTable.GetColumn (1);

hierarchicalClusters = [
    [ hArr.GetComponent (i, j) for j in range (0, hArr.GetNumberOfComponents ()) ] 
  for i in range (0, hArr.GetNumberOfTuples ()) ]

clusterProximities = [
    [ pArr.GetComponent (i, j) for j in range (0, pArr.GetNumberOfComponents ()) ] 
  for i in range (0, pArr.GetNumberOfTuples ()) ]

clusterModel = models.find_one({'model' : 'phc'})
if (clusterModel == None):
  clusterModel = {'model': 'phc',
                  'updated': datetime.datetime.utcnow (),
                  'initial': initialClusters,
                  'hierarchical': hierarchicalClusters,
                  'proximities': clusterProximities }
  print "Inserting a new PHC model"
  models.insert (clusterModel)
else:
  updatedModel = {'model': 'phc',
                  'updated': datetime.datetime.utcnow (),
                  'initial': initialClusters,
                  'hierarchical': hierarchicalClusters,
                  'proximities': clusterProximities }
  print "Updating the PHC model"
  models.update ({'model' : 'phc'}, updatedModel)

for model in models.find ({'model' : 'phc'}):
  print "model: " + model['model']  + " updated: " + str(model['updated'])
