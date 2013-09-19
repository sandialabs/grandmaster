#!/usr/bin/env python

#Copyright 2013 Sandia Corporation. Under the terms of Contract DE-AC04-94AL85000, there is a non-exclusive license for use of this work by or on behalf of the U.S. Government. Export of this program may require a license from the United States Government.

from mpi4py import MPI

import pymongo
import gridfs
import pickle

import sys, string, time
import unicodedata
import datetime

from vtk import *
from titan.TextAnalysis import *
from titan.DataAnalysis import *
from titan.MPIDataAnalysis import *
from titan.MPITextAnalysis import *

from optparse import OptionParser
parser = OptionParser ()
parser.add_option ("-d", "--db", dest="database",
                   help="Specify the mongo database to work with")
parser.add_option ("-t", "--topics", dest="topics", type="int", default=10,
                help="Specify the number of topics (concepts) to find in the documents (default 10)")

(options, args)  = parser.parse_args ()

if (options.database == None):
  print "You must specify a database.  Use -h for help"
  exit ();

mpicomm = MPI.COMM_WORLD
mpisize = mpicomm.Get_size ()
mpirank = mpicomm.Get_rank ()

controller = vtkMPIController ()
controller.Initialize ()

connection = pymongo.Connection ()
db = connection[options.database]
fs = gridfs.GridFS(db)

posts = db['posts']

post_id = vtkIdTypeArray ()
post_id.SetName ("document")
post_uri = vtkUnicodeStringArray ()
post_uri.SetName ("uri")
post_mimetype = vtkStringArray ()
post_mimetype.SetName ("mime_type")
post_content = vtkUnicodeStringArray ()
# post_content = vtkStringArray ()
post_content.SetName ("content")

post_internals = []

posts_len = posts.count ()
limit = int(posts_len / mpisize + 1)
skip = limit * mpirank

id = skip
for post in posts.find (skip=skip, limit=limit):
  post_internals.append (post['_id'])
  post_id.InsertNextValue (id)
  post_mimetype.InsertNextValue ("text/plain")
  post_uri.InsertNextValue (post['source'] + "/" + post['name'])
  post_content.InsertNextValue (post['content'])
  id = id + 1

postTable = vtkTable ()
postTable.AddColumn (post_id)
postTable.AddColumn (post_uri)
postTable.AddColumn (post_mimetype)
postTable.AddColumn (post_content)
postTable.GetRowData().SetPedigreeIds (post_id)

if (mpirank == 0):
  print "Number of Posts: " + str(posts_len)

textExtraction = vtkTextExtraction ()
textExtraction.SetInputData (postTable)
textExtraction.Update ()

lowerCase = vtkFoldCase ()
lowerCase.SetInputConnection (textExtraction.GetOutputPort ())
lowerCase.SetResultArray ("lower_case_text")
lowerCase.Update ()

filterHTTP = vtkFilterBounds ()
filterHTTP.SetInputArrayToProcess (0, 0, 0, vtkDataObject.FIELD_ASSOCIATION_ROWS, "lower_case_text")
filterHTTP.SetInputConnection (lowerCase.GetOutputPort ())
filterHTTP.SetFilterKey ("http")
filterHTTP.SetStopIndicators (" \t\n")
filterHTTP.SetResultArray ("filtered_html")
filterHTTP.SetReplacementText ("")
filterHTTP.Update ();

filterAMP = vtkFilterBounds ()
filterAMP.SetInputArrayToProcess (0, 0, 0, vtkDataObject.FIELD_ASSOCIATION_ROWS, "filtered_html")
filterAMP.SetInputConnection (filterHTTP.GetOutputPort ())
filterAMP.SetFilterKey ("&amp")
filterAMP.SetStopIndicators (";")
filterAMP.SetResultArray ("filtered_amp")
filterAMP.SetReplacementText ("")
filterAMP.Update ();

filterEmote = vtkFilterBounds ()
filterEmote.SetInputArrayToProcess (0, 0, 0, vtkDataObject.FIELD_ASSOCIATION_ROWS, "filtered_amp")
filterEmote.SetInputConnection (filterAMP.GetOutputPort ())
filterEmote.SetFilterKey ("&lt;3")
filterEmote.SetStopIndicators (" \t\n")
filterEmote.SetResultArray ("filtered_emote")
filterEmote.SetReplacementText ("")
filterEmote.Update ();

filterUser = vtkFilterBounds ()
filterUser.SetInputArrayToProcess (0, 0, 0, vtkDataObject.FIELD_ASSOCIATION_ROWS, "filtered_emote")
filterUser.SetInputConnection (filterEmote.GetOutputPort ())
filterUser.SetFilterKey ("@")
filterUser.SetStopIndicators (" \t\r\n.,;:?!")
filterUser.SetResultArray ("filtered_user")
filterUser.SetReplacementText ("")
filterUser.Update ();

tokenizer = vtkTokenizer ()
tokenizer.SetInputConnection (filterUser.GetOutputPort ())
tokenizer.SetInputArrayToProcess (0, 0, 0, vtkDataObject.FIELD_ASSOCIATION_ROWS, "document")
tokenizer.SetInputArrayToProcess (1, 0, 0, vtkDataObject.FIELD_ASSOCIATION_ROWS, "filtered_user")
tokenizer.DropWhitespace ()
tokenizer.DropPunctuation ()
tokenizer.Update ()

tokenValueFilter = vtkTokenValueFilter ()
tokenValueFilter.AddStopWordValues ()
tokenValueFilter.AddValue (u"rt")
tokenValueFilter.SetInputConnection (tokenizer.GetOutputPort ())
tokenValueFilter.Update ()

ngramExtract = vtkNGramExtraction ()
ngramExtract.SetInputConnection (tokenValueFilter.GetOutputPort ())
ngramExtract.Update ()

featureDictionary = vtkFeatureDictionary ()
# featureDictionary.SetInputConnection (ngramExtract.GetOutputPort ())
featureDictionary.SetInputConnection (tokenValueFilter.GetOutputPort ())
featureDictionary.Update ()

featureMapReduce = vtkPTermDictionaryMapReduce ()
featureMapReduce.SetController (controller)
featureMapReduce.SetInputConnection (featureDictionary.GetOutputPort ())
featureMapReduce.Update ()

if (mpirank == 0):
  terms = featureMapReduce.GetOutput ().GetColumnByName ('text')
  print "Number of terms " + str (terms.GetNumberOfTuples ())
  termsPython = [terms.GetValue (ind) for ind in range (0, terms.GetNumberOfTuples ())]

  print "Computing Frequency matrix\n";

frequencyMatrix = vtkFrequencyMatrix ()
frequencyMatrix.SetInputArrayToProcess (0, 0, 0, vtkDataObject.FIELD_ASSOCIATION_ROWS, "document")
frequencyMatrix.SetInputArrayToProcess (1, 0, 0, vtkDataObject.FIELD_ASSOCIATION_ROWS, "text")
frequencyMatrix.SetInputConnection (0, tokenValueFilter.GetOutputPort ())
frequencyMatrix.SetInputConnection (1, featureMapReduce.GetOutputPort ())
frequencyMatrix.SetInputConnection (2, textExtraction.GetOutputPort ())
frequencyMatrix.Update ()

matrix = frequencyMatrix.GetOutput (0)
matrixArray = matrix.GetArray (0)
extents = matrixArray.GetExtents ()
range0 = range (extents.GetExtent (0).GetBegin (), extents.GetExtent(0).GetEnd ())
range1 = range (extents.GetExtent (1).GetBegin (), extents.GetExtent(1).GetEnd ())

frequencyFilter = vtkPFrequencyMatrixFilter ()
frequencyFilter.SetController (controller)
frequencyFilter.SetInputConnection (0, featureMapReduce.GetOutputPort ())
frequencyFilter.SetInputConnection (1, frequencyMatrix.GetOutputPort ())
frequencyFilter.Update ()

plda = vtkPLatentDirichletAllocation ()
plda.SetController (controller)
# plda.SetInputConnection (frequencyMatrix.GetOutputPort (0))
plda.SetInputConnection (frequencyFilter.GetOutputPort (1))
plda.SetNumberOfTopics (options.topics)
plda.SetAlpha(2.0/options.topics)
plda.SetBeta(0.01)
#lda.SetBurnInIterations (800)
#lda.SetSamplingIterations (10)
#lda.SetNumberOfTrials (5)
# lda.DebugOn ()
if (mpirank == 0):
  print "Processing LDA"
plda.Update ()

theta = plda.GetOutput (0)
thetaArray = theta.GetArray (0)
extents = thetaArray.GetExtents ()
range0 = range (extents.GetExtent (0).GetBegin (), extents.GetExtent(0).GetEnd ())
range1 = range (extents.GetExtent (1).GetBegin (), extents.GetExtent(1).GetEnd ())

thetaPython = [ [ thetaArray.GetValue (i, j) for j in range1 ] for i in range0 ]

print "thetaLength " + str(len(thetaPython))

doc = 0
for id in post_internals:
  if (doc >= len(thetaPython)):
    break
  if (post_id.GetValue (doc) != range0[doc]):
    print "the ordering of theta doesn't match"
  post = posts.find_one ({'_id' : id})
  post['topic_distribution'] = thetaPython[doc]
  posts.update ({'_id' : post['_id']}, post)
  doc = doc + 1

if (doc != len(thetaPython)):
  print "Error writing out the topic distributions"
  exit ()

if (mpirank == 0): 
  phi = plda.GetOutput (1)
  phiArray = phi.GetArray (0)
  extents = phiArray.GetExtents ()
  range0 = range (extents.GetExtent (0).GetBegin (), extents.GetExtent(0).GetEnd ())
  range1 = range (extents.GetExtent (1).GetBegin (), extents.GetExtent(1).GetEnd ())
  
  phiPython = [ [ phiArray.GetValue (i, j) for j in range1 ] for i in range0 ]

  models = db['models']
  theModel = models.find_one({'model' : 'lda'}) 
  if (theModel == None):
    termsFS = fs.put (pickle.dumps(termsPython), filename="terms")
    phiFS = fs.put (pickle.dumps(phiPython), filename="phi")
    theModel = {'model': 'lda', 
                'updated': datetime.datetime.utcnow (),
                'topics' : options.topics,
                'terms' : termsFS, 
                'phi' : phiFS }
    print "Inserting a new LDA model"
    models.insert (theModel)
  else:
    fs.delete (theModel['terms'])
    fs.delete (theModel['phi'])
    termsFS = fs.put (pickle.dumps(termsPython), filename="terms")
    phiFS = fs.put (pickle.dumps(phiPython), filename="phi")
    updatedModel = {'model': 'lda',
                   'updated': datetime.datetime.utcnow (),
                   'topics' : options.topics,
                   'terms' : termsFS, 
                   'phi' : phiFS }
    print "Updating the LDA model"
    models.update ({'model' : 'lda'}, updatedModel)

  for model in models.find ({'model' : 'lda'}):
    print "model: " + model['model']  + " updated: " + str(model['updated'])

controller.Finalize ()
