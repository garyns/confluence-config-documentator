
var Confluence = require("./Confluence");
var md5 = require("md5");
var moment = require('moment')();
var fs = require('fs');
var colors = require('colors');
var os = require("os");
var stdio = require('stdio');

var config = {};
this.confluence = null;

function Confdoc(config) {

  if (config === undefined) {
    throw "No Config";
  }
    
  this.config = config;

  // Interact with Confluence via REST API.
  Confdoc.confluence = new Confluence(config);
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
      
    getContents(file, function(err, content, code) {
        if (err) {
            callback(err, null, null);
            return;
        }
        
        // STEP 2 We have file contents, next check we have all the required information.
        checkAttributes(config, file, content, function(err, results, code) {
            
            callback(err, results, code);
            
        });        
        
    });

}

/**
 * Get file content or read from stdin.
 */
getContents = function(infile, callback) {
    
    if (infile !== null) {
        
        try {
          
          infile = fs.realpathSync(infile); // Resolve symbolic links, else we fail.
          var stats = fs.lstatSync(infile);
          
          if (!stats.isFile()) {
             throw "Not File";
          }
          
          var content = fs.readFileSync(infile).toString('utf8');
          
        } catch (e) {
            
          callback("Could not find file " + infile, null, null);
          return;
          
        }
        
        callback(null, content, null);
        
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
        
        if (config.title) {
            return config.title;
        } else {
            return os.hostname() + ":"  + file;
        }
        
    } else {
        return title;
    }
    
} // resolveTitle()

/**
 * Resolve query used to find Confluence Page.
 */
resolveQuery = function(config, content, title) {
    
    var pattern = /^(.)\1[\s]*Query:(.*)$/mi; 
    var matches = pattern.exec(content);
    var query = matches ? matches[2].trim() : null;
    
    if ((query === undefined) || (query === null) || (query === "")) {
        
        if (config.query) {
            return config.query;
        } else {
            return title;
        }
        
    } else {
        return query;
    }
    
} // resolveQuery()

/**
 * Resolve Confluence Space Key.
 */
resolveSpaceKey = function(config, content) {
    
    var pattern = /^(.)\1[\s]*SpaceKey:(.*)$/m; 
    var matches = pattern.exec(content);
    var spaceKey = matches ? matches[2].trim() : null;
    
    if ((spaceKey === undefined) || (spaceKey === null) || (spaceKey === "")) {
        
        return config.spaceKey ? config.spaceKey : null;
        
    } else {
        
        return spaceKey;
    
    }    
        
} // resolveSpaceKey()

/**
 * Resolve Confluence Macro used to wrap file contents.
 */
resolveMacro = function(config, content) {
    
    var pattern = /^(.)\1[\s]*Macro:(.*)$/m; 
    var matches = pattern.exec(content);
    var macro = matches ? matches[2].trim() : null;
    
    if ((macro === undefined) || (macro === null) || (macro === "")) {
        
        return config.macro ? config.macro.toLowerCase() : "code";
        
    } else {
        
        return macro.toLowerCase();
    
    }    
        
} // resolveMacro()

/**
 * Resolve Confluence Page Id.
 */
resolvePageId = function(config, content) {
    
    var pattern = /^(.)\1[\s]*PageId:(.*)$/mi; 
    var matches = pattern.exec(content);
    var pageId = matches ? matches[2].trim() : null;
    
    
    if ((pageId === undefined) || (pageId === null) || (pageId === "")) {
    
        if (!config.pageId) {
          return null;           
        } else {
          return parseInt(config.pageId);
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
        
        if (!config.parentId) {
            return null;
        }
        
        return parseInt(config.parentId);
        
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
        
        return config.labels ? config.labels : [];
        
    } else {
        
        return labels;
    
    }    
        
} // resolveSpaceKey()


/**
 * Check that we have all the information required to create or update a page in Confluence.
 */
checkAttributes = function(config, file, content, callback) {
    
    var pageatts = {};
    
    if (file === null) {
      file = 'stdin';
    }
    
    pageatts.spaceKey = resolveSpaceKey(config, content);
    pageatts.title = resolveTitle(config, content, file);
    pageatts.pageId = resolvePageId(config, content);
    pageatts.parentId = resolveParentId(config, content);
    pageatts.labels = resolveLabels(config, content);
    pageatts.macro = resolveMacro(config, content);
    pageatts.file = file;
    pageatts.query = resolveQuery(config, content, pageatts.title);
    
    if (config.verbose || !config.quiet) {
        
      console.log("File:     " + pageatts.file);
      console.log("SpaceKey: " + (typeof pageatts.spaceKey === 'string' ? pageatts.spaceKey : ""));
      console.log("Title:    " + pageatts.title);
      console.log("Query:    " + pageatts.query);
      console.log("Macro:    " + pageatts.macro);
      console.log("PageId:   " + (pageatts.pageId ? pageatts.pageId : ""));
      console.log("ParentId: " + (pageatts.parentId ? pageatts.parentId : ""));
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
                    
                    callback(page.message);
                    
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
        
    } else if (pageatts.title == pageatts.query) {
        
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
                    
                } else if (response.results.length > 1) {
                    
                    var ids = [];
                    for (i in response.results) {
                        ids.push(response.results[i].id);
                    }
                    
                    var ids = ids.join(",");
                    
                    callback("Multiple results found for query (pageIds=" + ids + "). Will only continue for unique result.", null);
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
        
    } else {
        
        pageatts.pageId = null;
        pageatts.version = null;
        pageatts.body = null;
        
        Confdoc.confluence.pageSearch(pageatts.spaceKey, pageatts.query, "body.storage,version", function(err, response) {
     
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
                
                } else if (response.results.length > 1) {
                    
                    var ids = [];
                    for (i in response.results) {
                        ids.push(response.results[i].id);
                    }
                    
                    var ids = ids.join(",");
                    
                    callback("Multiple results found for query (pageIds=" + ids + "). Will only continue for unique result.", null);
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
    
    var d = null;
    
    if (pageatts.macro && pageatts.macro === "html") {
       d = updateHtmlMacro(pageatts.file, pageatts.body, content);
    } else if (pageatts.macro && pageatts.macro === "panel") {
       d = updatePanelMacro(pageatts.file, pageatts.body, content);       
    } else {
       // default = code
       d = updateCodeMacro(pageatts.file, pageatts.body, content);
    }
    
    pageatts.body  = d.body;
    contentChanged = d.changed;
  
    if (pageatts.pageId) {
    
        if (config.verbose && contentChanged) {
            console.debug("File content has changed.".yellow);
    
        } else if (config.verbose && !contentChanged) {
            console.debug("File content has not changed.".yellow);
        }
        
        if (!contentChanged && !config.force) {
            callback(null, (pageatts.pageId + " "  + pageatts.title + " no content change detected."), "NO_CHANGE");
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
 * Create or Update a {html} macro with a new title and content body.
 */
updateHtmlMacro = function(file, body, content) {
  
    var now = moment.format("YYYY-MM-DD, h:mm:ssa");
    
    var pattern = /<ac:structured-macro[\S\s.]*?ac:name="html"[\S\s.]*?>([\S\s.]*?)<\/ac:structured-macro>/gi;
    var matchesMacro = body ? body.match(pattern) : false;
    var codeBlockFound = false;
    var contentChanged = false;
    
    //console.log(matchesMacro);
    //process.exit()
    
    if (matchesMacro) {
        
        for (i in matchesMacro) {
            
            var m = matchesMacro[i];
        
            var pattern = /<!\[CDATA\[<!--title:(.*?)-->[\r\n]?([.\S\s]*?)]]>/gi; // [1] == title, [2] == content
            var matches = pattern.exec(m);
            
            if ((matches) && (matches[1].toLowerCase().indexOf(file.toLowerCase()) !== -1)) {
              
              //console.log("MATCH " + matches[1] + "\n\n");
                
                var hash = md5(content.replace(/\r\n/g, "\n"));
                var oldHash = md5(matches[2].replace(/\r\n/g, "\n"));
                    
                if (hash != oldHash) {
                    contentChanged = true;
                }
       
                //var newTitle = file + " (" + now + ") {" + hash + "}";
                var newTitle = file + " (" + now + ")";
 
                var m2 = m.replace(matches[2], content);
                m2 = m2.replace(matches[1], newTitle);
                body = body.replace(m, m2);
                codeBlockFound = true;
            }                
        
        }
        
        if (!codeBlockFound) {
            contentChanged = true;
            var hash = md5(content);
            body += createHtmlMacro(file + " (" + now + ")", content);
        }

        return {
           body: body,
           changed: contentChanged
        };
         
    } else {
        
        if (body === null) {
            body = "";
        }
        
        var hash = md5(content);
        body += createHtmlMacro(file + " (" + now + ")", content);
        return {
           body: body,
           changed: false
        };
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
                    
                    var hash = md5(content.replace(/\r\n/g, "\n"));
                    var oldHash = md5(matchCode[1].replace(/\r\n/g, "\n"));
                    
                    if (hash != oldHash) {
                        contentChanged = true;
                    }
                    
                    var newTitle = file + " (" + now + ")";
 
                    var m2 = m.replace(matchCode[1], content);
                    m2 = m2.replace(titleMatches[1], newTitle);
                    body = body.replace(m, m2);
                    codeBlockFound = true;
                }
                
            }                
        
        }
        
        if (!codeBlockFound) {
            contentChanged = true;
            var hash = md5(content);
            body += createCodeMacro(file + " (" + now + ")", content);
        }

        return {
           body: body,
           changed: contentChanged
        };
         
    } else {
        
        if (body === null) {
            body = "";
        }
        
        var hash = md5(content);
        body += createCodeMacro(file + " (" + now + ")", content);
        return {
           body: body,
           changed: false
        };
    }
    
} // updateCodeMacro()

/**
 * Create or Update a {panel} macro with a new title and content body.
 */
updatePanelMacro = function(file, body, content) {
   
    var now = moment.format("YYYY-MM-DD, h:mm:ssa");
    
    var pattern = /<ac:structured-macro[\S\s.]*?ac:name="panel"[\S\s.]*?>[\S\s.]*?<\/ac:rich-text-body><\/ac:structured-macro>/gi;
    var matchesMacro = body ? body.match(pattern) : false;
    var blockFound = false;
    var contentChanged = false;

    if (matchesMacro) {
        
        for (i in matchesMacro) {
            
            var m = matchesMacro[i];
            //console.log("MACRO MATCH " + m + "\n\n");
        
            var patternTitle = /<ac:parameter[\S\s.]*?ac:name="title"[\S\s.]*?>(.*?)<\/ac:parameter>/gi;
            var titleMatches = patternTitle.exec(m);
            
            //console.log("TITLE MATCH " + titleMatches + "\n\n");
            
            if ((titleMatches) && (titleMatches[1].toLowerCase().indexOf(file.toLowerCase()) !== -1)) {
                
                var patternCode = /<ac:rich-text-body>([\S\s.]*)<\/ac:rich-text-body>/gi
                var matchCode = patternCode.exec(m);
                
                //console.log("PANEL MATCH " + matchCode + "\n\n");
                
                if (matchCode) {
                    
                    var hash = md5(content.replace(/\r\n/g, "\n"));
                    var oldHash = md5(matchCode[1].replace(/\r\n/g, "\n"));
                    
                    //console.log("PANEL HASH CHECK ", "*"+content+"*", "*"+matchCode[1]+"*");
                    //console.log(hash, oldHash);
                    
                    if (hash != oldHash) {
                        contentChanged = true;
                    }
                    
                    var newTitle = file + " (" + now + ")";
 
                    var m2 = m.replace(matchCode[1], content);
                    m2 = m2.replace(titleMatches[1], newTitle);
                    body = body.replace(m, m2);
                    blockFound = true;
                }
                
            }                
        
        }
        
        if (!blockFound) {
            contentChanged = true;
            var hash = md5(content);
            body += createPanelMacro(file + " (" + now + ")", content);
        }

        var r = {
           body: body,
           changed: contentChanged
        };
        
        return r;
         
    } else {
        
        if (body === null) {
            body = "";
        }
        
        var hash = md5(content);
        body += createPanelMacro(file + " (" + now + ")", content);
        return {
           body: body,
           changed: false
        };
    }
    
} // updatePanelMacro()

/**
 * Create a new Confluence {panel} macro.
 */
createPanelMacro = function(title, content) {
  
  var m = '<ac:structured-macro ac:name="panel">\
  <ac:parameter ac:name="bgColor"></ac:parameter>\
  <ac:parameter ac:name="titleBGColor"></ac:parameter>\
  <ac:parameter ac:name="title">' + title + '</ac:parameter>\
  <ac:parameter ac:name="borderStyle"></ac:parameter>\
  <ac:parameter ac:name="borderColor"></ac:parameter>\
  <ac:parameter ac:name="titleColor"></ac:parameter>\
  <ac:rich-text-body>' + content + '</ac:rich-text-body> \
</ac:structured-macro>';
    
  return m;
}

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

/**
 * Create a new Confluence {html} macro.
 */
createHtmlMacro = function(title, content) {
    
    var m = '<ac:structured-macro ac:name="html"> \
  <ac:plain-text-body><![CDATA[<!--title:' + title + '-->\n' + content + ']]></ac:plain-text-body>\
</ac:structured-macro>';
    
    return m;
}

module.exports = Confdoc;