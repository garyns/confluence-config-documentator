#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var stdio = require('stdio');
var colors = require('colors');
var moment = require('moment')();
var os = require("os");
var Confluence = require("./Confluence");
var selfupdate = require('selfupdate');
var packageJSON = require('./package.json');

if (process.argv.length <= 2) {
    
    console.log(packageJSON.name + " " + packageJSON.version);
    console.log("\nUsage " +  process.argv[1] + " --server <confluence_server_url>  --username <username> --password <password> [--spaceKey <key>] [--parentId <id>] [--pageId <id>] [--title <title>] [--labels <labels>] [--quiet] [--noupgrade]>");
    console.log("\nFor more information " + process.argv[1] + " --help\n or visit https://www.npmjs.com/package/confluence-config-documentator");
    process.exit(1);
    
}

var ops = stdio.getopt({
    _meta_: {args: 1},
    'quiet': {key: 'q', description: 'Suspress non-error output', default:false},
    'verbose': {key: 'v', description: 'Verbose output', default:false},
    'noupgrade': {key:"n", description: 'Suspress new version check', default:false},
    'server': {key: 's', args: 1, description: 'Confluence Server URL', mandatory: true},
    'username': {key: 'u', args: 1, description: 'Confluence Username', mandatory: true},
    'password': {key: 'p', args: 1, description: 'Confluence Password', mandatory: true},
    'spaceKey': {key: 'k', args:1, description: "Confluence Space Key", mandatory: false, default:null},
    'parentId': {key: 'o', args:1, description: "Confluence Parent Page Id (when creating new page. Space root used if not specified)", mandatory: false, default: null},
    'pageId': {key: 'i', args:1, description: "Confluence Page Id (if not specified, title will be used to find page.)", mandatory: false, default: null},
    'title': {key: 't', args:1, description: "Confluence Page Title (defaults to hostname:filename)", mandatory: false, default: null},
    //'status': {key: 'a', multiple: true, description: "Add a static macro", mandatory: false, default: null},
    'labels': {key: 'l', multiple: true, description: "Add page labels. Comma separated.", mandatory: false, default: null}
});

var file = ops['args'] ? ops['args'][0] : null;
if (file !== null) {
    file = path.resolve(file);
}

var config = {
    
    verbose: ops['verbose'],
    quiet: ops['verbose'] ? false : ops['quiet'],
    noupgrade: ops['noupgrade'],
    
    // If the settings are not specified in 'file' the following defaults are used.
    defaultTitle: ops['title'],
    defaultPageId: ops['pageId'],
    defaultParentId: ops['parentId'],
    defaultSpaceKey: ops['spaceKey'],
    //defaultStatus: typeof ops['status'] === "string" ? ops['status'].split(",") : [],
    defaultLabels: typeof ops['labels'] === "string" ? ops['labels'].split(",") : [],
    
    confluenceConfig: {
        username: ops['username'],
        password: ops['password'],
        baseUrl:  ops['server'],
        debug: false
    }
    
} // config
    
var confluence = new Confluence(config.confluenceConfig);

//------------------------------------------------------------------------------

checkForNewVersion();

getContent(file, function(err, content) {
    
    if (err) {
        
        console.error(err);
        process.exit(1);
        
    } else {
        
        checkAttributes(config, file, content, function(err, results) {
            
            if (err) {
              console.error(err);
              process.exit(1);
            }
            
        });
    }
    
});


//------------------------------------------------------------------------------

function getContent(file, callback) {
    
    if (file !== null) {
        
        try {
            
          var stats = fs.lstatSync(file);
          
          if (!stats.isFile()) {
             throw "Not File";
          }
          
          var content = fs.readFileSync(file).toString();
          
        } catch (e) {
            
          callback("Could not find file " + file, null);
          
        }
        
        callback(null, content);
        
    } else {
        
        /**
         * Null file means piped input.
         */
        
        stdio.read(function(content) {
            callback(null, content);
        })
    
    }

} // getContent()


function resolveTitle(config, content, file) {
    
    var pattern = /^(.)\1[\s]*Title:(.*)$/mi; 
    var matches = pattern.exec(content);
    var title = matches ? matches[2].trim() : null;
    
    if ((title === undefined) || (title === null) || (title === "")) {
        
        if (content.defaultTitle) {
            return config.defaultTitle;
        } else {
            return os.hostname() + ":"  + file;
        }
        
    } else {
        return title;
    }
    
} // resolveTitle()

function resolveSpaceKey(config, content) {
    
    var pattern = /^(.)\1[\s]*SpaceKey:(.*)$/m; 
    var matches = pattern.exec(content);
    var spaceKey = matches ? matches[2].trim() : null;
    
    if ((spaceKey === undefined) || (spaceKey === null) || (spaceKey === "")) {
        
        return config.defaultSpaceKey;
        
    } else {
        
        return spaceKey;
    
    }    
        
} // resolveSpaceKey()

function resolvePageId(config, content) {
    
    var pattern = /^(.)\1[\s]*PageId:(.*)$/mi; 
    var matches = pattern.exec(content);
    var pageId = matches ? matches[2].trim() : null;
    
    
    if ((pageId === undefined) || (pageId === null) || (pageId === "")) {
    
        if (!config.defaultPageId) {
          return null;           
        } else {
          return parseInt(config.defaultPageId);
        }
        
    } else {
        
        return parseInt(pageId);
    
    }    
        
} // resolveParentId()

function resolveParentId(config, content) {
    
    var pattern = /^(.)\1[\s]*ParentId:(.*)$/mi; 
    var matches = pattern.exec(content);
    var parentId = matches ? matches[2].trim() : null;
    
    
    if ((parentId === undefined) || (parentId === null) || (parentId === "")) {
        
        if (!config.defaultParentId) {
            return null;
        }
        
        return parseInt(config.defaultParentId);
        
    } else {
        
        return parseInt(parentId);
    
    }    
        
} // resolveParentId()

function resolveLabels(config, content) {
    
    var pattern = /^(.)\1[\s]*Labels?:(.*)$/mi; 
    var matches = pattern.exec(content);
    var labels = matches ? matches[2].trim().split(",") : null;
    
    if ((labels === undefined) || (labels === null) || (labels === "")) {
        
        return config.defaultLabels;
        
    } else {
        
        return labels;
    
    }    
        
} // resolveSpaceKey()

/*
function resolveStatus(config, content) {
    
    var pattern = /^(.)\1Status:(.*)$/mi; 
    var matches = pattern.exec(content);
    var status = matches ? matches[2].trim().split(",") : status;
    
    if ((status === undefined) || (status === null) || (status === "")) {
        
        return config.defaultStatus;
        
    } else {
        
        return status;
    
    }    
        
} // resolveStatus()
*/

function checkAttributes(config, file, content, callback) {
    
    var pageatts = {};
    
    pageatts.spaceKey = resolveSpaceKey(config, content);
    pageatts.title = resolveTitle(config, content, file);
    pageatts.pageId = resolvePageId(config, content);
    pageatts.parentId = resolveParentId(config, content);
    //pageatts.status = resolveStatus(config, content);
    pageatts.labels = resolveLabels(config, content);
    pageatts.file = file;
    
    if (config.verbose || !config.quiet) {
        
      console.log(file.yellow);
      console.log("SpaceKey: " + (typeof pageatts.spaceKey === 'string' ? pageatts.spaceKey : ""));
      console.log("Title:    " + pageatts.title);
      console.log("PageId:   " + (pageatts.pageId ? pageatts.pageId : ""));
      console.log("ParentId: " + (pageatts.parentId ? pageatts.parentId : ""));
      //console.log("Status:   " + pageatts.status);
      console.log("Labels:   " + pageatts.labels);
    }
    
    if ((pageatts.spaceKey === undefined) || (pageatts.spaceKey === null) || (typeof pageatts.spaceKey !== "string") ||  (pageatts.spaceKey.trim() === "")) {
        if (callback) {
            callback("SpaceKey is required. Nothing uploaded", null);
            return;
        }
    }

    updatePageAtts(config, pageatts, function(err, pageatts) {
        
        if (err) {
            console.error(err);
            return;
        } else if (pageatts === null) {
            console.error("Page not found".red.bold);
            return;
        } else {
            updatePage(config, pageatts, content);
        }
    });
    
} // checkAttributes()

function updatePageAtts(config, pageatts, callback) {    
    
    if (pageatts.pageId) {
        
        pageatts.version = page.version.number;
        pageatts.body = page.body.storage.value;        

        confluence.getContentById(pageatts.pageId, "body.storage,version", function(err, page) {
            
            if (page.statusCode && page.statusCode !== 200) {
                
                if (config.verbose) {
                    callback(err);
                } else {
                    callback(page.message)
                };
                
                return;
            } else if (err) {
                
                callback(err, null);
                return;
            
            } else {
                
                pageatts.pageId = page.id,
                pageatts.version = page.version.number;
                pageatts.body = page.body.storage.value;
                
                callback(null, pageatts);
                return;
            }
            
        });
        
    } else if (pageatts.title) {
        
        pageatts.pageId = null;
        pageatts.version = null;
        pageatts.body = null;
        
        confluence.getContentByPageTitle(pageatts.spaceKey, pageatts.title, "body.storage,version", function(err, response) {
     
            if (response.statusCode && response.statusCode !== 200) {
                
                if (config.verbose) {
                    callback(err);
                } else {
                    callback(response);
                };
                
                return;
            } else if (err) {
                callback(err, null);
                return;
            } else {
                
                if (response.results.length === 0) {
                                        
                    callback(null, pageatts);
                    return;
                    
                } else {
                
                    pageatts.pageId = response.results[0].id,
                    pageatts.version = response.results[0].version.number;
                    pageatts.body = response.results[0].body.storage.value;
                    
                    callback(null, pageatts);
                    return;
                  
                }
            }
            
        });        
        
    }
    
} // updatePageAtts()

function updatePage(config, pageatts, content) {
    
    pageatts.body = updateCodeMacro(pageatts.file, pageatts.body, content);
    
    if (pageatts.pageId === null) {
        
        confluence.postContent(pageatts.spaceKey, pageatts.title, pageatts.body, pageatts.parentId, function(err, response) {
            
            if (err) {
                
                if (config.verbose) {
                    console.error(err);
                } else {
                    console.error(response);
                }
                
                
            } else {
                
                pageatts.pageId = response.id;
                pageatts.version = response.version.number;
                addTags(pageatts);
                
                if (!config.quiet) {
                  console.log((pageatts.pageId + " "  + pageatts.title + " created").green);
                }
                
            }
            
        });        
        
    } else {
        
        var minorEdit = true;
        confluence.putContent(pageatts.spaceKey, pageatts.pageId, pageatts.version+1, pageatts.title, pageatts.body, minorEdit, function(err, response) {
            
            if (err) {
                
                if (config.verbose) {
                    console.error(err);
                } else {
                    console.error(response);
                }
                
                
            } else {
                
                addTags(pageatts);
                        
                pageatts.version = response.version.number;
                
                if (!config.quiet) {
                    console.log((pageatts.pageId + " "  + pageatts.title + " updated").green);
                }
                
                
            }
            
        });
        
    }
    
}// updatePage()

function addTags(pageatts) {
    
    if (pageatts.labels.length > 0) {
        confluence.addLabels(pageatts.pageId, pageatts.labels, function(err, response) {
            
            if (err) {
                console.log(err);
            }
            
        });
    }
    
}

function updateCodeMacro(file, body, content) {
   
    var now = moment.format("YYYY-MM-DD, h:mm:ssa");
    
    var pattern = /<ac:structured-macro[\S\s.]*?ac:name="code"[\S\s.]*?>([\S\s.]*?)<\/ac:structured-macro>/g;
    var matchesMacro = body ? body.match(pattern) : false;

    if (matchesMacro) {
        
        for (i in matchesMacro) {
            
            var m = matchesMacro[i];
            //console.log("MACRO MATCH " + m + "\n\n");
        
            var patternTitle = /<ac:parameter[\S\s.]*?ac:name="title"[\S\s.]*?>(.*?)<\/ac:parameter>/gi;
            var titleMatches = patternTitle.exec(m);
            
            //console.log("TITLE MATCH " + titleMatches + "\n\n");
            
            if ((titleMatches) && (titleMatches[1].toLowerCase().indexOf(file.toLowerCase()) !== -1)) {
                
                var patternCode = /<!\[CDATA\[([\S\s.]*?)\]\]>/gi
                var matchCode = patternCode.exec(m);
                
                //console.log("CODE MATCH " + matchCode + "\n\n");
                
                if (matchCode) {
                    
                    var newTitle = file + " (" + now + ")";
 
                    var m2 = m.replace(matchCode[1], content);
                    m2 = m2.replace(titleMatches[1], newTitle);
                    body = body.replace(m, m2);
                }
                
            }                
        
        }

         //process.exit();
         return body;
         
    } else {
        
        if (body === null) {
            body = "";
        }
        
        body += createCodeMacro(file + " (" + now + ")", content);
        return body;
    }
    
} // updateCodeMacro()


/**
 * Check is a new version if avaiable and output messge if there is.
 */
function checkForNewVersion() {
    if (!config.noupgrade && config.verbose) {
        selfupdate.isUpdated(packageJSON, function(error, isUpdated) {
            if(error) throw error;
            
            if (!isUpdated) {
                var m = 'A newer version of ' + packageJSON.name + " is available. Use this command to upgrade:\n   npm -g update " + packageJSON.name;
                console.log(m.green);
            }
            
        });
    }
} // checkForNewVersion()


function createCodeMacro(title, content) {
    
    var m = '<ac:structured-macro ac:name="code">\
  <ac:parameter ac:name="title">' + title + '</ac:parameter>\
  <ac:parameter ac:name="linenumbers">true</ac:parameter> \
  <ac:parameter ac:name="collapse">false</ac:parameter>\
  <ac:plain-text-body><![CDATA[' + content + ']]></ac:plain-text-body>\
</ac:structured-macro>';
    
    return m;
}

/*
function createStatusMacro(title, color, outline) {
    
    if (color === undefined) {
        color = "gray";
    }
    
    if (outline === undefined) {
        outline = false;
    }    
    
    return '<ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">' + color + '</ac:parameter><ac:parameter ac:name="title">' + title + '</ac:parameter><ac:parameter ac:name="subtle">' + outline + ' </ac:parameter></ac:structured-macro>';    
}
*/

console.error = function(err) {
    
    if (typeof err === "string") {
        console.log(err.red.bold);
    } else {
        
        var output = false;
        
        if (err.message) {
            console.log(err.message.red.bold);
            output = true;
        }
        
        if (err.response && err.response.message) {
            console.log(err.response.message.red.bold);
            output = true;
        }
        
       if (err.response && err.response.text && err.response.text.message) {
            console.log(err.esponse.text.message.red.bold);
            output = true;
        }        
        
        if (!output) {
            console.log(JSON.stringify(err).red.bold);
        }
        
        
    }
}
