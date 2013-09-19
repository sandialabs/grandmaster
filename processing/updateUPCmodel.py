#!/usr/bin/env python

#Copyright 2013 Sandia Corporation. Under the terms of Contract DE-AC04-94AL85000, there is a non-exclusive license for use of this work by or on behalf of the U.S. Government. Export of this program may require a license from the United States Government.

import pymongo

import sys, string, time
import unicodedata
import datetime

from vtk import *
from titan.TextAnalysis import *
from titan.DataAnalysis import *
from titan.MachineLearning import *

if len (sys.argv) < 2:
  print "Usage: " + sys.argv[0] + " database" 
  exit ()

from optparse import OptionParser
parser = OptionParser ()
parser.add_option ("-d", "--db", dest="database",
                   help="Specify the mongo database to work with")
parser.add_option ("-k", "--clusters", dest="clusters", type="int", default=5,
                help="Specify the number of user groups to find (default 5)")

(options, args)  = parser.parse_args ()

if (options.database == None):
  print "You must specify a database.  Use -h for help"
  exit ();

connection = pymongo.Connection ()
db = connection[options.database]

models = db['models']
phcModel = models.find_one({'model' : 'phc'})
if (len (phcModel['initial']) == 0):
  print "Cluster model is too small"
  exit ()

userTable = vtkTable ()
for i in range (0, len (phcModel['initial'])):
  column = vtkDoubleArray ()
  column.SetName (str(i))
  userTable.AddColumn (column)

users = db['users']
posts = db['posts']

progress = 0
delta = 1.0/float(users.count ())
next_report = 0.1
for user in users.find ():
  progress += delta
  if progress > next_report:
    sys.stdout.write (".")
    sys.stdout.flush ()
    next_report += 0.1

  clusterValues = [0]*len (phcModel['initial'])
  for post in posts.find ({'name' : string.lower (user['name'])}):
    cluster = int(post['cluster_assignment'][0])
    clusterValues[cluster] += post['cluster_proximity'][0]
  user['post_clusters'] = clusterValues
  users.update ({'_id' : user['_id']}, user)
  for i in range(0, len(clusterValues)):
    userTable.GetColumn (i).InsertNextValue (clusterValues[i])

cluster = vtkPHClustering ()
cluster.SetInputData (userTable)
cluster.SetNumberOfClusters (options.clusters)
cluster.SetNumberOfTrials (10)
print "Processing UPC"
cluster.Update ()

clusterTable = cluster.GetOutput (0)
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
for user in users.find ():
  if (doc >= len(assignmentsPython)):
    break
  user['cluster_assignment'] = assignmentsPython[doc]
  user['cluster_proximity'] = assignmentProxPython[doc]
  users.update ({'_id' : user['_id']}, user)
  doc += 1

if (doc != len(assignmentsPython)):
  print "Error assignments and users don't match " + str(doc) + " " + str(len(assignmentsPython))
  exit ()

cArr = clusterTable.GetColumn (0)
clusters = [ 
    [ cArr.GetComponent (i, j) for j in range (0, cArr.GetNumberOfComponents ()) ] 
  for i in range (0, cArr.GetNumberOfTuples ()) ]

pArr = hierarchicalTable.GetColumn (1);
clusterProximities = [
    [ pArr.GetComponent (i, j) for j in range (0, pArr.GetNumberOfComponents ()) ] 
  for i in range (0, pArr.GetNumberOfTuples ()) ]

clusterModel = models.find_one({'model' : 'upc'})
if (clusterModel == None):
  clusterModel = {'model': 'upc',
                  'updated': datetime.datetime.utcnow (),
                  'cluster': clusters,
                  'proximities': clusterProximities }
  print "Inserting a new UPC model"
  models.insert (clusterModel)
else:
  updatedModel = {'model': 'upc',
                  'updated': datetime.datetime.utcnow (),
                  'cluster': clusters,
                  'proximities': clusterProximities }
  print "Updating the UPC model"
  models.update ({'model' : 'upc'}, updatedModel)

for model in models.find ({'model' : 'upc'}):
  print "model: " + model['model']  + " updated: " + str(model['updated'])
