Building Titan for Grandmaster
==============================

For the purposes of this document, we'll assume you uncompress the Titan.zip or Titan.tar.gz into the same directory it's located in the grandmaster codebase under the titan/ subdirectory.  Uncompressing this way will create, grandmaster/titan/titan-2.0

Download the vtk-5.10.1 source from vtk.org.  Uncompress this into titan-2.0/TPL/ and then either rename the directory to VTK or symbolic link VTK to the VTK5.10.1 produced by the distribution file.

Make a directory grandmaster/titan/titan-2.0_build and cd into that directory.

run "sh ../do-configure"  You may need to install the latest cmake from cmake.org

then run "make"


