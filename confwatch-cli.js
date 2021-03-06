#!/usr/bin/env node

var stdio = require('stdio');
var chokidar = require('chokidar');
var fs = require("fs");
var path = require("path");
var colors = require('colors');
var os = require("os");
var async = require("async");
var Confdoc = require("./lib/confdoc");
var moment = require('moment')();
var watcher  = null;
var configFile = null;
var queue = [];

var config = {
    username: null,
    password: null,
    server: null,
    spaceKey: null,
    verbose: false,
    timeout: 60
}

var ops = stdio.getopt({
    'verbose': {key: 'v', description: 'Verbose output', default:false},
    'config': {key: 'c', description: 'Configuration File (defaults to ~/.confdoc)', mandatory:false, args:1},
    'watch': {key: 'w', description: 'Watch files', mandatory:false, args:0},
    'add': {key: 'a', description: 'Add file', mandatory:false, multiple: true},
    'remove': {key: 'r', description: 'Remove file', mandatory:false, multiple: true},
    'list': {key: 'l', description: 'List watched files', mandatory:false, args:0},
    'force': {key: 'f', description: 'Force upload of all files now', mandatory:false, default:false}
});

/**
 * Log error messages to console.
 */
console.error = function(err) {
   
    if (config.verbose) {
       console.log(JSON.stringify(err, null, 2).red.bold);
       return;
    }
   
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

loadConfig();


// Update config.
config.verbose = ops['verbose'];
config.force = ops['force'];

var confdoc = new Confdoc(config);

var actionPerformed = false;

if (ops['add']) {
    actionPerformed = addFiles();
}

if (ops['remove']) {
    actionPerformed = removeFiles();
}

if (ops['list']) {
    listFiles();
    actionPerformed = true;
}

if (actionPerformed) {
   saveConfig();
}

if (ops['force']) {
    uploadAll();
    actionPerformed = true;
}

if (ops['watch']) {
    
    watchConfig();
    
    var watching = watch();
    
    actionPerformed = true;
}

if (!actionPerformed) {
    console.log("\nWatch files for changes and upload them to Confluence.\n")
    ops.printHelp();
    console.log("\nFor more information visit https://www.npmjs.com/package/confluence-config-documentator\n");
    process.exit(1);
}


// Reinitialse on config change.
function watchConfig() {
  var configWatcher = chokidar.watch();
  
    configWatcher
      .on('add', function(path) {
        
        console.log("Watching " + path + " (the confwatch config file)");
        
        })
      .on('change', function(path, stats) {
        
         //var now = new Date().toISOString().slice(0, 19).replace('T', ' '); // MySQL style dttm.
         var now = moment.format("YYYY-MM-DD, h:mm:ssa");
         
         console.log(path + " changed @ " + now);
         console.log("Reloading configuration.");
        
         loadConfig(); 
         watch();
         
       })
      .on('error', function(error) {
 
        console.error(error);
        
       });
      
      configWatcher.add(configFile);
}


function watch() {
    
    if (watcher) {
        watcher.close();
        watcher = null;
    }
    
    /*
    if (!config.watch || config.watch.length == 0) {
        console.log("No files to watch. Add some with --add");
        return false;
    }
    */
    
    var watchCount = 0;
    
    var log = console.log.bind(console);
    
    watcher = chokidar.watch();
    
    // Add event listeners
    /*
    watcher
      .on('add', function(path) { log('File', path, 'has been added'); })
      .on('change', function(path, stats) {
          log('File', path, 'has been changed');
          if (stats) log('File', path, 'changed size to', stats.size);
       })
      .on('unlink', function(path) { log('File', path, 'has been removed'); })
      .on('addDir', function(path) { log('Directory', path, 'has been added'); })
      .on('unlinkDir', function(path) { log('Directory', path, 'has been removed'); })
      .on('error', function(error) { log('Error happened', error); })
      .on('ready', function() { log('Initial scan complete. Ready for changes.'); })
      .on('raw', function(event, path, details) { log('Raw event info:', event, path, details); })
    */
    
    watcher
      .on('add', function(path) {
          log("Watching " + path);
        })
      .on('change', function(path, stats) {
         //var now = new Date().toISOString().slice(0, 19).replace('T', ' '); // MySQL style dttm.
         var now = moment.format("YYYY-MM-DD, h:mm:ssa");
         console.log(path + " changed @ " + now + ". " + config.timeout + " seconds until upload.");
         
         var to = queue[path];
         
         if (to !== undefined) {
            
            clearTimeout(to);

            var to = setTimeout(function() {
                
                upload(path);
                delete queue[path];
                
            }, config.timeout * 1000);
            
            queue[path] = to;            
            
         } else {

            var to = setTimeout(function() {
                
                upload(path);
                delete queue[path];
                
            }, config.timeout * 1000);
            
            queue[path] = to;
         }
         
       })
      .on('error', function(error) {
 
        console.error(error);
        
       });
      
    for (i in config.watch) {        
        var f = config.watch[i];
        
        try {
                
          stats = fs.statSync(f);
          watcher.add(f);
          watchCount++;
          
        } catch (e) {
          
          if (ops['verbose']) {
            console.error(e);
          } else {
            console.error("Cannot watch " + f + ". It does not exist or is not readable. Use --verbose for more information.");
          }
        }
        
    }
    
    //return watchCount > 0;
    return true;
}


function upload(file, callback) {
    
    confdoc.upload(file, function(err, msg, code) {
         
        if (code === "NO_CHANGE") {
            
            console.log(msg.green);
            
        } else {
            
          if (err) {
            
            console.error(err);      
            
          } else {
        
            console.log(msg.green);
          
          }
        }
        
        if (callback) callback(err, msg);
        
    });    
}

function addFiles() {
    
    if (typeof ops['add'] === "string") {
        ops['add'] = [ops['add']];
    }
    
    if (ops['add'].length > 0) {
        if (!config.watch) {
            config.watch = [];
        }
            
        for (i in ops['add']) {
            var f = ops['add'][i];
            
            try {
                
              stats = fs.statSync(f);
              
              var f = path.resolve(f);
              
              if (config.watch.indexOf(f) === -1) {
              
                config.watch.push(f);
                console.log("Watching " + f);
                return true;
                
              } else {
                
                console.log("Already watching " + f);
                return false;
                
              }

               
            } catch (e) {
            
               
                if (ops['verbose']) {
                  console.error(e);
                } else {
                  console.error("File not found or not readable: " + f +". Use --verbose for more information.");
                }               
               
            }
           
        }
    }    
}

function removeFiles() {
    
    
    if (typeof ops['remove'] === "string") {
        ops['remove'] = [ops['remove']];
    }
    
    if (ops['remove'].length > 0) {
        
        if (!config.watch) {
            config.watch = [];
        }
            
        for (i in ops['remove']) {
            var f = ops['remove'][i];
            
            try {
              
              var f = path.resolve(f);
                
              var index = config.watch.indexOf(f);
                                
              if (index > -1) {
                  config.watch.splice(index, 1);
                  console.log("No longer watching " + f);
                  return true;
              } else {
                  console.log("Was not watching " + f);
                  return false;
              }
               
            } catch (e) {

               console.error("File not found or not readable: " + f);
               return false;
               
            }
           
        }
    }     
    
}

function listFiles() {

    if (!config.watch) {
        console.log("Not watching any files.");
        return;
    }
    
    console.log("Watching " + config.watch.length + " file" + (config.watch.length !== 1 ? "s" : ""));
    for (i in config.watch) {
        var f = config.watch[i];
        console.log("  " + f);
    }
}


function uploadAll() {
    
    if (!config.watch) {
        console.log("Not watching any files.");
        return;
    }
    
    var series = [];
    
    for (i in config.watch) {
        var f = config.watch[i];
        
        var data = {}
        data.file = f;
        
        series.push(function(callback) {
            
            upload(this.file, callback);
            
        }.bind(data));
        
    }
    
    async.series(series, function (err, results) {
        //
    });
    
}

function saveConfig() {
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
}

function loadConfig() {
    
    if (ops['config'] && (typeof ops['config'] === "string")) {
        
        configFile = ops['config'];
        
    } else if (os.homedir) {
        
        configFile = os.homedir() + '/.confdoc';
        
    }
        
    try {
          stats = fs.statSync(configFile);
          
        try {
            /**
             * Read default parameters from ~/.confdoc. Any parameters one the command line or defined in the inout file will override these.
             */
            config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            
        } catch (e) {
            console.log(("Failed to parse JSON in " + configFile).red.bold);
            showUsage();
            process.exit(1);       
        }         
              
    } catch (e) {
        // File not found.
        console.log(("Failed to load configuration in " + configFile).red.bold);
        process.exit(1);        
    }
    
    if (config.timeout === undefined) {
        config.timeout = 60;
    }
}