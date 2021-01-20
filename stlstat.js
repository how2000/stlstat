const fs = require('fs');
const readline = require('readline');

const L = console.log;

var action = "stats";
var filename = "";

var myArgs = process.argv.slice(2);
for (var i=0; i<myArgs.length; i++) {
  var a = myArgs[i];
  if (a == "fix") action = "fix";
  else if ( a == "-?" || a == "help" || a == "-h" || a == "-H") {}
  else filename = a;
}

if (filename =="") {
  L("Usage: node stlstat.js [fix] <STL-file>");
  L("         fix - outputs fixed STL file to stdout,");
  L("         otherwise, outputs information about STL-file to stdout.");
  process.exit(0);
}

var solidName = " ";
var lineCount = 0;
var vtxLineCount = 0;

var facetCount = 0;
var fac = [];
var vtx = [];
var uniqV = [];

var vDup = 0;
var tol = 0.01;
var vNear = 0;

var removedFacets = 0;
var facetRemovalMethod = "none";


const rl = readline.createInterface({
  input: fs.createReadStream(filename),
  //input: process.stdin,
  crlfDelay: Infinity
});

function shorten(f) {
  return Math.round((f + Number.EPSILON) * 100) / 100;
}
function myParseFloat(s) {
  var f = parseFloat(s);
  if (isNaN(f)) {
    L("Err: At line#",lineCount,"    Expected a float value.  Given:", s);
    outputStats(true, 1);
  }
  return f;
}

rl.on('line', (line) => {
  lineCount++;
  var la = line.trim().split(/\s+/);
  if (la.length > 0) {
    //L(la);

    if (la[0]=='vertex') {
      vtxLineCount++;
      // round the x,y,z to 2 decimal places
      var x = shorten(myParseFloat(la[1]));
      var y = shorten(myParseFloat(la[2]));
      var z = shorten(myParseFloat(la[3]));
      vtx.push([x,y,z]);

      // check the vertex against known vertices
      var isDup = false;
      var isNear = false;
      for (var i=0; i<uniqV.length; i++) {
        var vx = uniqV[i][0];
        var vy = uniqV[i][1];
        var vz = uniqV[i][2];
        if (x==vx && y==vy && z==vz) {
          // we've seen this vertex before
          isDup = true;
          vDup++;
          break;  // stop the search
        }
        else if ((Math.abs(x-vx) <= tol) && (Math.abs(y-vy) <= tol) && (Math.abs(z-vz) <= tol)) {
          // this vertex is next to a known vertex
          //L(vx,vy,vz);
          //L(x,y,z);
          //L("");
          isNear = true;
          // modify this vertex to the known one.
          vtx[vtx.length-1] = [vx, vy, vz]
          vNear++;
          break;  // stop the search
        }
      }
      if (isDup == false && isNear == false) {
        // new vertex
        uniqV.push([x,y,z]);
      }
    }
    else if (la[0]=='facet') {
      facetCount++;
      var x = shorten(myParseFloat(la[2]));
      var y = shorten(myParseFloat(la[3]));
      var z = shorten(myParseFloat(la[4]));
      fac.push([x,y,z]);
    }
    else if (la[0]=='solid') {
      if (la.length > 1) solidName = la[1];
    }
  }
});

function isSmall(a,b,c) {
  var n = 0;
  if ((Math.abs(a[0]-b[0]) <= 0.01) && (Math.abs(a[1]-b[1]) <= 0.01) && (Math.abs(a[2]-b[2]) <= 0.01)) n++;
  if ((Math.abs(a[0]-c[0]) <= 0.01) && (Math.abs(a[1]-c[1]) <= 0.01) && (Math.abs(a[2]-c[2]) <= 0.01)) n++;
  if ((Math.abs(b[0]-c[0]) <= 0.01) && (Math.abs(b[1]-c[1]) <= 0.01) && (Math.abs(b[2]-c[2]) <= 0.01)) n++;
  return n > 0;
}

function isDotOrLine(a,b,c) {
  var n = 0;
  if ((Math.abs(a[0]-b[0]) < 0.01) && (Math.abs(a[1]-b[1]) < 0.01) && (Math.abs(a[2]-b[2]) < 0.01)) n++;
  if ((Math.abs(a[0]-c[0]) < 0.01) && (Math.abs(a[1]-c[1]) < 0.01) && (Math.abs(a[2]-c[2]) < 0.01)) n++;
  if ((Math.abs(b[0]-c[0]) < 0.01) && (Math.abs(b[1]-c[1]) < 0.01) && (Math.abs(b[2]-c[2]) < 0.01)) n++;
  return n > 0;
}

function markFacets(compFunc) {
  facetRemovalMethod = compFunc.name;
  var markCount = 0;
  for (var i=0; i<fac.length; i++) {
    if (compFunc(vtx[i*3],vtx[i*3+1],vtx[i*3+2])) {
      fac[i] = fac[i].push(true);
      markCount++;
    }
  }
  return markCount;
}

function outputFacets(marked=false) {
  var count = 0;
  for (var i=0; i<fac.length; i++) {
    if ((marked==false && fac[i].length==3)
          || (marked==true && fac[i].length>3)) {
      L("  facet normal", fac[i][0], fac[i][1], fac[i][2]);
      L("    outer loop");
      L("      vertex", vtx[i*3][0], vtx[i*3][1], vtx[i*3][2]);
      L("      vertex", vtx[i*3+1][0], vtx[i*3+1][1], vtx[i*3+1][2]);
      L("      vertex", vtx[i*3+2][0], vtx[i*3+2][1], vtx[i*3+2][2]);
      L("    endloop");
      L("  endfacet");
      count++;
    }
  }
  return count;
}

function outputStats(exitAfter = false, exitCode = 0) {
  L('Filename:   ', filename);
  L('Solid Name: ', solidName);
  L('Line Count: ', lineCount);
  L('Facet Count:', facetCount);
  
  L("Final Merged Vertex Count:", uniqV.length);
  L("Same Vertices Spotted:", vDup);
  L("Vertices Merged:", vNear);
  L("tol:",tol);
  L('Facets Removed:', removedFacets);
  L('Facet Removal Method:', facetRemovalMethod+"()");
  L();

  if (exitAfter) {
    L("Exit code:", exitCode);
    process.exit(exitCode);
  }
}

rl.on('close', () => {
  removedFacets = markFacets(isDotOrLine);
  if (action=="stats") {
    outputStats(true, 0);
  }
  else if (action=="fix") {
    solidName += "_stlstat";  // append to the name to now it's been fixed.
    L("solid "+solidName);
    outputFacets();
    L("endsolid "+solidName+"\n");
  }
});
