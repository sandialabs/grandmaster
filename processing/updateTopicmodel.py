#!/usr/bin/env python

#Copyright 2013 Sandia Corporation. Under the terms of Contract DE-AC04-94AL85000, there is a non-exclusive license for use of this work by or on behalf of the U.S. Government. Export of this program may require a license from the United States Government.

import pymongo
import gridfs
import pickle
import Queue
import datetime

from optparse import OptionParser
parser = OptionParser ()
parser.add_option ("-d", "--db", dest="database",
                   help="Specify the mongo database to work with")
parser.add_option ("-m", "--maxterms", dest="maxterms", type="int", default=25,
                help="Specify the number of terms to keep (default: 25)")

(options, args)  = parser.parse_args ()

if (options.database == None):
  print "You must specify a database.  Use -h for help"
  exit ();

connection = pymongo.Connection ()
db = connection[options.database]
fs = gridfs.GridFS(db)

models = db['models']
ldaModel = models.find_one({'model' : 'lda'}) 

print "Got the model"

phiString = fs.get (ldaModel['phi']).read()
print "Got the phistring"

termsString = fs.get (ldaModel['terms']).read()
print "got the termsString"

phi = pickle.loads (phiString)
print "processed the phiString"

terms = pickle.loads (termsString)
print "processed the termsString"

topics = []
for topic in range(0, len(phi)):
  queue = Queue.PriorityQueue (options.maxterms)
  for term in range(0, len(phi[topic])):
    tuple = (phi[topic][term], terms[term])
    if queue.full ():
      top = queue.get ()
      if (phi[topic][term] > top[0]):
        queue.put (tuple)
      else:
        queue.put (top)
    else:
      queue.put (tuple)
  topic = []
  while (not queue.empty ()):
    topic.insert (0, queue.get ())
  topics.append (topic)

topicModel = models.find_one({'model' : 'topic'}) 
if (topicModel == None):
  topicModel = {'model' : 'topic',
                'updated': datetime.datetime.utcnow (),
                'topics' : topics}
  print "Inserting a new Topic model"
  models.insert (topicModel)
else:
  updatedModel = {'model' : 'topic',
                'updated': datetime.datetime.utcnow (),
                'topics' : topics}
  print "Updating the Topic model"
  models.update ({'model' : 'topic'}, updatedModel)

for model in models.find ({'model' : 'topic'}):
  print "model: " + model['model']  + " updated: " + str(model['updated'])
