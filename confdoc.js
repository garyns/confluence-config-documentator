
var Confluence = require("./Confluence");
var md5 = require("md5");
var moment = require('moment')();
var fs = require('fs');
var colors = require('colors');
var os = require("os");

var config = {};
this.confluence = null;

function Confdoc(config) {

  if (config === undefined) {
    throw "No Config";
  }
    
  this.config = config;

  // Interact with Confluence via REST API.
  Confdoc.confluence = new Confluence(config.confluenceConfig);
}

//------------------------------------------------------------------------------

/**
 * Log debug messages to console.
 */
console.debug = function() {
    
    for (var i = 0; i < arguments.length; i++) {
      var t = arguments[i];
    
     if (typeof t === "string") {
        
        console.log(t.yellow);
    
      } else {
        
        console.log(JSON.stringify(t).yellow);
      }
        
    }

}

//------------------------------------------------------------------------------

/**
 * STEP 1 Start by getting the content of the config file.
 */
Confdoc.prototype.upload = function(file, callback) {
    
    var config = this.config;
      
    getContents(file, function(err, content) {
        if (err) {
            callback(err, null);
            return;
        }
        
        // STEP 2 We have file contents, next check we have all the required information.
        checkAttributes(config, file, content, function(err, results) {
            
            callback(err, results);
            
        });        
        
    });

}

/**
 * Get file content or read from stdin.
 */
getContents = function(infile, callback) {
    
    if (infile !== null) {
        
        try {
            
          var stats = fs.lstatSync(infile);
          
          if (!stats.isFile()) {
             throw "Not File";
          }
          
          var content = fs.readFileSync(infile).toString('utf8');
          
        } catch (e) {
            
          callback("Could not find file " + infile, null);
          
        }
        
        callback(null, content);
        
    } else {
        
        /**
         * Null file means piped input.
         */
        
        stdio.read(function(content) {
            file = "STDIN";
            callback(null, content);
        })
    
    }

} // getContent()

/**
 * Resolve title for Confluence Page.
 */
resolveTitle = function(config, content, file) {
    
    var pattern = /^(.)\1[\s]*Title:(.*)$/mi; 
    var matches = pattern.exec(content);
    var title = matches ? matches[2].trim() : null;
    
    if ((title === undefined) || (title === null) || (title === "")) {
        
        if (config.defaultTitle) {
            return config.defaultTitle;
        } else {
            return os.hostname() + ":"  + file;
        }
        
    } else {
        return title;
    }
    
} // resolveTitle()

/**
 * Resolve Confluence Space Key.
 */
resolveSpaceKey = function(config, content) {
    
    var pattern = /^(.)\1[\s]*SpaceKey:(.*)$/m; 
    var matches = pattern.exec(content);
    var spaceKey = matches ? matches[2].trim() : null;
    
    if ((spaceKey === undefined) || (spaceKey === null) || (spaceKey === "")) {
        
        return config.defaultSpaceKey;
        
    } else {
        
        return spaceKey;
    
    }    
        
} // resolveSpaceKey()

/**
 * Resolve Confluence Page Id.
 */
resolvePageId = function(config, content) {
    
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

/**
 * Resolve Confluence Parent Page Id
 */
resolveParentId = function(config, content) {
    
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

/**
 * Resolve Confluence Page Labels.
 */
resolveLabels = function(config, content) {
    
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

/**
 * Check that we have all the information required to create or update a page in Confluence.
 */
checkAttributes = function(config, file, content, callback) {
    
    var pageatts = {};
    
    pageatts.spaceKey = resolveSpaceKey(config, content);
    pageatts.title = resolveTitle(config, content, file);
    pageatts.pageId = resolvePageId(config, content);
    pageatts.parentId = resolveParentId(config, content);
    //pageatts.status = resolveStatus(config, content);
    pageatts.labels = resolveLabels(config, content);
    pageatts.file = file;
    
    if (config.verbose || !config.quiet) {
        
      console.log("File:     " + file);
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

    // STEP 3 We have the basic information, now update with results from Confluence. 
    updatePageAtts(config, pageatts, function(err, pageatts) {
        
        if (err) {
            callback(err, null);
            return;
        } else if (pageatts === null) {
            callback("Page not found".red.bold, null);
            return;
        } else {
            
            // STEP 4 Update (or Create) Confluence Page.
            updatePage(config, pageatts, content, callback);
        }
    });
    
} // checkAttributes()

/**
 * Find page to update Confluence. If we don't find a page, a new one will be created later.
 */
updatePageAtts = function(config, pageatts, callback) {    
    
    if (pageatts.pageId) {        

        Confdoc.confluence.getContentById(pageatts.pageId, "body.storage,version", function(err, page) {
            
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
        
        Confdoc.confluence.findContentByPageTitle(pageatts.spaceKey, pageatts.title, "body.storage,version", function(err, response) {
     
            if (response && response.statusCode && response.statusCode !== 200) {
                
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
                    
                    // No Page. It's a new page.
                    
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

/**
 * Creates or Updates a Confluence Page and includes the input file in a {code} macro.
 */
updatePage = function(config, pageatts, content, callback) {
    
    var d = updateCodeMacro(pageatts.file, pageatts.body, content);
    pageatts.body  = d.body;
    contentChanged = d.changed;
  
    if (pageatts.pageId) {
    
        if (config.verbose && contentChanged) {
            console.debug("File content has changed.".yellow);
    
        } else if (config.verbose && !contentChanged) {
            console.debug("File content has not changed.".yellow);
        }
        
        if (!contentChanged && !config.force) {
            callback(null, (pageatts.pageId + " "  + pageatts.title + " no content change detected. Use --force to update."));
            return;
        }
    }
    
    if (pageatts.pageId === null) {
        
        //
        // Creating a new page.
        //
        
        Confdoc.confluence.postPageContent(pageatts.spaceKey, pageatts.title, pageatts.body, pageatts.parentId, function(err, response) {
            
            if (err) {
                
                if (config.verbose) {
                    callback(err);
                } else {
                    callback(response);
                }
                
            } else {
                
                pageatts.pageId = response.id;
                pageatts.version = response.version.number;
                
                // Step 5 Add Labels to Page.
                addTags(pageatts, function(err, res) {
                    if (err) {
                        
                        callback(err);
                        
                    } else {
                    
                      callback(null, (pageatts.pageId + " "  + pageatts.title + " created"));
                    }
                });
            }
            
        });        
        
    } else {
        
        //
        // Updaing an existing page (because we have a page id).
        //        
        
        var minorEdit = !contentChanged;
        Confdoc.confluence.putPageContent(pageatts.spaceKey, pageatts.pageId, pageatts.version+1, pageatts.title, pageatts.body, minorEdit, function(err, response) {
            
            if (err) {
                
                if (config.verbose) {
                    callback(err);
                } else {
                    callback(response);
                }    
                
            } else {
                
                // Step 5 Add Labels to Page.
                addTags(pageatts, function(err, res) {
                    
                    if (err) {
                        callback(err, null);
                    } else {
                        pageatts.version = response.version.number;
                            callback(null, (pageatts.pageId + " "  + pageatts.title + " updated"));                      
                        
                    }
                });
                        

                
                
            }
            
        });
        
    }
    
}// updatePage()


/**
 * Add labels to a Confluence Page.
 */
addTags = function(pageatts, callback) {
    
    if (pageatts.labels.length > 0) {
        Confdoc.confluence.addLabels(pageatts.pageId, pageatts.labels, function(err, response) {
            
            if (err) {
                callback(err, null);
            } else {
                callback(null, null);
            }
            
        });
    } else {
        callback(null, null);
    }
    
}

/**
 * Create or Update a {code} macro with a new title and content body.
 */
updateCodeMacro = function(file, body, content) {
   
    var now = moment.format("YYYY-MM-DD, h:mm:ssa");
    
    var pattern = /<ac:structured-macro[\S\s.]*?ac:name="code"[\S\s.]*?>([\S\s.]*?)<\/ac:structured-macro>/g;
    var matchesMacro = body ? body.match(pattern) : false;
    var codeBlockFound = false;
    var contentChanged = false;

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
                    
                    var hash = md5(content);
                    var oldHash = md5(matchCode[1]);
                    
                    if (hash != oldHash) {
                        contentChanged = true;
                    }
                    
                    var newTitle = file + " (" + now + ") {" + hash + "}";
 
                    var m2 = m.replace(matchCode[1], content);
                    m2 = m2.replace(titleMatches[1], newTitle);
                    body = body.replace(m, m2);
                    codeBlockFound = true;
                }
                
            }                
        
        }
        
        if (!codeBlockFound) {
            var hash = md5(content);
            body += createCodeMacro(file + " (" + now + ") {" + hash + "}", content);
        }

        return {
           body: body,
           changed: contentChanged
        };
        //return body;
         
    } else {
        
        if (body === null) {
            body = "";
        }
        
        body += createCodeMacro(file + " (" + now + ")", content);
        return {
           body: body,
           changed: false
        };
    }
    
} // updateCodeMacro()


/**
 * Create a new Confluence {code} macro.
 */
createCodeMacro = function(title, content) {
    
    var m = '<ac:structured-macro ac:name="code">\
  <ac:parameter ac:name="title">' + title + '</ac:parameter>\
  <ac:parameter ac:name="linenumbers">true</ac:parameter> \
  <ac:parameter ac:name="collapse">false</ac:parameter>\
  <ac:plain-text-body><![CDATA[' + content + ']]></ac:plain-text-body>\
</ac:structured-macro>';
    
    return m;
}

/*
reateStatusMacro = function(title, color, outline) {
    
    if (color === undefined) {
        color = "gray";
    }
    
    if (outline === undefined) {
        outline = false;
    }    
    
    return '<ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">' + color + '</ac:parameter><ac:parameter ac:name="title">' + title + '</ac:parameter><ac:parameter ac:name="subtle">' + outline + ' </ac:parameter></ac:structured-macro>';    
}
*/

module.exports = Confdoc;