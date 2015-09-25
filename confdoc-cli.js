#!/usr/bin/env node

var stdio = require('stdio');
var fs = require('fs');
var path = require('path');
var colors = require('colors');
var selfupdate = require('selfupdate');
var packageJSON = require('./package.json');
var os = require("os");
var Confdoc = require("./lib");

var userConfigJSON = {
    username: null,
    password: null,
    server: null,
    spaceKey: null
}

if (os.homedir) {
    try {
        /**
         * Read default parameters from ~/.confdoc. Any parameters one the command line or defined in the inout file will override these.
         */
        userConfigJSON = JSON.parse(fs.readFileSync(os.homedir() + '/.confdoc', 'utf8'));
        
    } catch (e) {
        // File not found or not parsable.
        // console.error(e);
    }
}

if (process.argv.length <= 2) {
    
    console.log(packageJSON.name + " " + packageJSON.version);
    console.log("\nUsage confdoc --server <confluence_server_url> --username <username> --password <password> [--spaceKey <key>] [--parentId <id>] [--pageId <id>] [--title <title>] [--labels <labels>] [--quiet] [--noupgrade] <input_file>");
    console.log("Use @ for input_file to pipe from stdin");
    console.log("\nFor more information confdoc --help\n or visit https://www.npmjs.com/package/confluence-config-documentator");
    
    checkForNewVersion();
    return;
}

var ops = stdio.getopt({
    _meta_: {args: 1},
    'quiet': {key: 'q', description: 'Suspress non-error output', default:false},
    'verbose': {key: 'v', description: 'Verbose output', default:false},
    'noupgrade': {key:"n", description: 'Suspress new version check', default:false},
    'server': {key: 's', args: 1, description: 'Confluence Server URL', mandatory: !userConfigJSON.server, default:userConfigJSON.server},
    'username': {key: 'u', args: 1, description: 'Confluence Username', mandatory: !userConfigJSON.username, default:userConfigJSON.username},
    'password': {key: 'p', args: 1, description: 'Confluence Password', mandatory: !userConfigJSON.password, default:userConfigJSON.password},
    'force': {key: 'f', description: 'Force page update even if no change in content', default:false},
    'spaceKey': {key: 'k', args:1, description: "Confluence Space Key", mandatory: false, default:userConfigJSON.spaceKey},
    'parentId': {key: 'o', args:1, description: "Confluence Parent Page Id (when creating new page. Space root used if not specified)", mandatory: false, default:userConfigJSON.parentId ? userConfigJSON.parentId : null},
    'pageId': {key: 'i', args:1, description: "Confluence Page Id (if not specified, title will be used to find page.)", mandatory: false, default: null},
    'title': {key: 't', args:1, description: "Confluence Page Title (defaults to hostname:filename)", mandatory: false, default: null},
    //'status': {key: 'a', multiple: true, description: "Add a static macro", mandatory: false, default: null},
    'labels': {key: 'l', multiple: true, description: "Add page labels. Comma separated.", mandatory: false, default: null}
});

var file = ops['args'] ? ops['args'][0] : null;
if (file !== null && file !== "@") {
    file = path.resolve(file); // Absolute file.
} else {
    file = null;
}

var config = {
    
    verbose: ops['verbose'],
    quiet: ops['verbose'] ? false : ops['quiet'],
    noupgrade: ops['noupgrade'],
    force: ops['force'],
    
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
        server:  ops['server'],
        debug: ops['verbose']
    }
    
} // config

/**
 * Check is a new version if avaiable and output messge if there is.
 */
function checkForNewVersion() {
    if (!config || (!config.noupgrade && !config.quiet)) {
        selfupdate.isUpdated(packageJSON, function(error, isUpdated) {
            if(error) throw error;
            
            if (!isUpdated) {
                var m = 'A newer version of ' + packageJSON.name + " is available. Use this command to upgrade:\n   npm -g update " + packageJSON.name;
                console.log(m.green);
            }
            
        });
    }
} // checkForNewVersion()


var confdoc = new Confdoc(config);

/**
 * Log error messages to console.
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
            console.log(err.response.text.message.red.bold);
            output = true;
        }        
        
        if (!output) {
            console.log(JSON.stringify(err).red.bold);
        }
        
        
    }
}

confdoc.upload(file, function(err, content) {
    
    if (err) {
        console.error(err);
        process.exit(1);
    }
    
    console.log(content.green);
    
});


