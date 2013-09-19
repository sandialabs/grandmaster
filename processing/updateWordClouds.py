#!/usr/bin/env python

#Copyright 2013 Sandia Corporation. Under the terms of Contract DE-AC04-94AL85000, there is a non-exclusive license for use of this work by or on behalf of the U.S. Government. Export of this program may require a license from the United States Government.

import pymongo

import sys, string, time
import unicodedata
import datetime

import copy

from vtk import *
from titan.TextAnalysis import *
from titan.DataAnalysis import *

from optparse import OptionParser
parser = OptionParser ()
parser.add_option ("-d", "--db", dest="database",
                   help="Specify the mongo database to work with")

(options, args)  = parser.parse_args ()

if (options.database == None):
  print "You must specify a database.  Use -h for help"
  exit ();

connection = pymongo.Connection ()
db = connection[options.database]

models = db['models']
phcModel = models.find_one({'model' : 'phc'})
init_len = len (phcModel['initial'])
if (init_len == 0):
  print "Cluster model is too small"
  exit ()

dictionaryArray = [None] * len(phcModel['hierarchical'])

posts = db['posts']

print "Processing posts"

post_id = vtkIdTypeArray ()
post_id.SetName ("document")
post_uri = vtkUnicodeStringArray ()
post_uri.SetName ("uri")
post_mimetype = vtkStringArray ()
post_mimetype.SetName ("mime_type")
post_content = vtkUnicodeStringArray ()
post_content.SetName ("content")

cluster_array = []
cluster_proximity = []

id = 0
for post in posts.find ():
  post_id.InsertNextValue (id)
  post_mimetype.InsertNextValue ("text/plain")
  post_uri.InsertNextValue (post['source'] + "/" + post['name'])
  post_content.InsertNextValue (post['content'])
  cluster_array.append (int(post['cluster_assignment'][0]))
  prox = post['cluster_proximity'][0]
  cluster_proximity.append (prox * prox)
  id = id + 1

postTable = vtkTable ()
postTable.AddColumn (post_id)
postTable.AddColumn (post_uri)
postTable.AddColumn (post_mimetype)
postTable.AddColumn (post_content)
postTable.GetRowData().SetPedigreeIds (post_id)

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
filterEmote.SetStopIndicators (" ")
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
featureDictionary.SetInputConnection (ngramExtract.GetOutputPort ())
# featureDictionary.SetInputConnection (tokenValueFilter.GetOutputPort ())
featureDictionary.Update ()

terms = featureDictionary.GetOutput ().GetColumnByName ('text')
termsPython = [terms.GetValue (ind) for ind in range (0, terms.GetNumberOfTuples ())]

print "Computing frequency matrix"

frequencyMatrix = vtkFrequencyMatrix ()
frequencyMatrix.SetInputArrayToProcess (0, 0, 0, vtkDataObject.FIELD_ASSOCIATION_ROWS, "document")
frequencyMatrix.SetInputArrayToProcess (1, 0, 0, vtkDataObject.FIELD_ASSOCIATION_ROWS, "text")
frequencyMatrix.SetInputConnection (0, tokenValueFilter.GetOutputPort ())
frequencyMatrix.SetInputConnection (1, featureDictionary.GetOutputPort ())
frequencyMatrix.SetInputConnection (2, textExtraction.GetOutputPort ())
frequencyMatrix.Update ()

matrix = frequencyMatrix.GetOutput (0)
matrixArray = matrix.GetArray (0)
extents = matrixArray.GetExtents ()
range0 = range (extents.GetExtent (0).GetBegin (), extents.GetExtent(0).GetEnd ())
range1 = range (extents.GetExtent (1).GetBegin (), extents.GetExtent(1).GetEnd ())


tfVectorPython = [ [ 0 for j in range0 ] for i in range (0, init_len) ]

size = matrixArray.GetNonNullSize ()
print "Summing term frequencies " + str(size)
coords = vtkArrayCoordinates ()
for index in range (0, size):
  matrixArray.GetCoordinatesN (index, coords)
  term_index = coords.GetCoordinate(0)
  post_num = coords.GetCoordinate(1)
  value = matrixArray.GetValueN (index)
  tfVectorPython[cluster_array[post_num]][term_index] += value * cluster_proximity[post_num]

print "Computing term sizes"

for cluster in range (0, init_len):
  d = {}
  
  if (len(termsPython) != len(tfVectorPython[cluster])):
    print "There's a problem";

  max = 0
  for term in range(len(termsPython)):
    if (tfVectorPython[cluster][term] > max):
       max = tfVectorPython[cluster][term]

  for term in range(len(termsPython)):
    val = tfVectorPython[cluster][term] / max
    if (val > 0.1):
      d[termsPython[term]] = val

  dictionaryArray[cluster] = d


sys.stdout.write ('\n')

for cluster in range (0, len(phcModel['hierarchical']) - 1): # last is always root.
  parent = int(phcModel['hierarchical'][cluster][0])
  if (dictionaryArray[parent] == None):
    dictionaryArray[parent] = copy.deepcopy (dictionaryArray[cluster])
  else:
    for key in dictionaryArray[cluster].keys():
      val = dictionaryArray[cluster][key]
      if (dictionaryArray[parent].has_key (key)):
        dictionaryArray[parent][key] += val
      else:
        dictionaryArray[parent][key] = val

wordModel = models.find_one({'model' : 'wordCloud'})
if (wordModel == None):
  wordModel = {'model': 'wordCloud',
               'updated': datetime.datetime.utcnow (),
               'dictionaries': dictionaryArray}
  models.insert (wordModel)
else:
  updated = {'model': 'wordCloud',
               'updated': datetime.datetime.utcnow (),
               'dictionaries': dictionaryArray}
  print "Updating the WordCloud model"
  models.update ({'model' : 'wordCloud'}, updated)

for model in models.find ({'model' : 'wordCloud'}):
  print "model: " + model['model']  + " updated: " + str(model['updated'])
