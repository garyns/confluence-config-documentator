var request = require('superagent');

var config = {};

function Confluence(config) {
    
    if (!(this instanceof Confluence)) return new Confluence(config);

    if (!config || !config.username || !config.password || !config.server) {
        throw new Error("Bad Config: username, password and server are all required.");
    }

    this.config = config;
    this.config.server = this.config.server.endsWith("/") ? this.config.server.substring(0, this.config.server.length-1) : this.config.server;  // Ensure server does not end with a /
}


Confluence.prototype.getHomePage = function(space, callback) {
    var config = this.config;
    
    var url = config.server + "/rest/api/space?spaceKey=" + space;
    
    if (this.config.debug) {
        console.debug("GET: " + url);
    }    

    request
        .get(url)
        .auth(config.username, config.password)
        .end(function(err, res){
            if (err) {
                callback(err);
            }
            else {
                try {
                    var url = config.server + res.body.results[0]._expandable.homepage;
                    request
                        .get(url)
                        .auth(config.username, config.password)
                        .end(function(err, res){
                            callback(err, res && res.body ? res.body : null);
                        });                      
                }
                catch (e) {
                    callback("Space home page could not be found. " + e.message, res);
                }
            }
        });

};

Confluence.prototype.getContentById = function(id, expand, callback) {
    
    if (expand === undefined) {
        expand = "version,body.view";
    }
    
    var url = this.config.server + "/rest/api/content/" + id + "?expand=" + expand;

    request
        .get(url)
        .auth(this.config.username, this.config.password)
        .end(function(err, res){
           callback(err, res && res.body ? res.body : null);
        });
        
    if (this.config.debug) {
        console.debug("GET: " + url);
    }
};

Confluence.prototype.findContentByPageTitle = function(space, title, expand, callback) {
    
    if (expand === undefined) {
        expand = "version,body.view";
    }    
        
    var q =
        "?spaceKey=" + encodeURIComponent(space) +
        "&title=" + encodeURIComponent(title) +
        "&expand=" + expand;
        
    var url = this.config.server + "/rest/api/content" + q;

    request
        .get(url)
        .auth(this.config.username, this.config.password)
        .end(function(err, res){
            callback(err, res && res.body ? res.body : null);
        });
        
    if (this.config.debug) {
        console.debug("GET: " + url);
    }

};

Confluence.prototype.pageSearch = function(space, query, expand, callback) {
    
    if (expand === undefined) {
        expand = "version,body.view";
    }    
        
    var q =
        "?cql=space=" + encodeURIComponent(space) +
        " AND (text~\"" + encodeURIComponent(query) + "\" OR title~\"" + encodeURIComponent(query) + "\")" +
        "&expand=" + expand;
        
    var url = this.config.server + "/rest/api/content/search" + q;

    request
        .get(url)
        .auth(this.config.username, this.config.password)
        .end(function(err, res){
            callback(err, res && res.body ? res.body : null);
        });
        
    if (this.config.debug) {
        console.debug("GET: " + url);
    }

};

Confluence.prototype.postPageContent = function(spaceKey, title, content, parentId, callback) {
    
    var config = this.config;
    
    var page = {
        "type": "page",
        "title": title,
        "space": {
            "key": spaceKey
        },
        "ancestors": [{
            "type": "page"
        }],
        "body": {
            "storage": {
                "value": content,
                "representation": "storage"
            }
        }
    };

    function newPage() {
        
        var url = config.server + "/rest/api/content";
        
        request
            .post(url)
            .auth(config.username, config.password)
            .type('json')
            .send(page)
            .end(function(err, res){
                callback(err, res.body);
            });
            
            
        if (config.debug) {
            console.debug("POST: " + url, page);
        }            
    }

    if (!parentId) {
        this.getHomePage(spaceKey, function(err, res) {
            if (err) callback(err);

            else if (!res || !res.id) {
                callback("Can't find space home page.");
            }
            else {
                page.ancestors[0].id = res.id;
                newPage();
            }
        });
    }
    else {
        page.ancestors[0].id = parentId;
        newPage();
    }

};

Confluence.prototype.putPageContent = function(spaceKey, id, version, title, content, minorEdit, callback) {
    
    var config = this.config;
    
    if (minorEdit === undefined) {
        minorEdit = true;
    }
    
    var page = {
        "id": id,
        "type": "page",
        "title": title,
        "space": {
            "key": spaceKey
        },
        "version": {
            "number": version,
            "minorEdit": minorEdit
        },
        "body": {
            "storage": {
                "value": content,
                "representation": "storage"
            }
        }
    };
    
    var url = this.config.server + "/rest/api/content/" + id + "?expand=version";

    request
        .put(url)
        .auth(this.config.username, this.config.password)
        .type('json')
        .send(page)
        .end(function(err, res){
            callback(err, res.body);
        });
        
        if (config.debug) {
            console.debug("PUT: " + url, page);
        }

};

Confluence.prototype.addLabels = function(id, labels, callback) {
    
    if (typeof labels === "string") {
        labels = labels.split(",");
    }
    
    var labeldefs = [];
    for (i in labels) {
        
        var labeldef = {
            "name": labels[i],
            "prefix": "global"
        };
        
        labeldefs.push(labeldef);
    }
    
    var url = this.config.server + "/rest/api/content/" + id + "/label";

    request
        .post(url)
        .auth(this.config.username, this.config.password)
        .send(labeldefs)
        .end(function(err, res){
            callback(err, res);
        });

    if (this.config.debug) {
        console.debug("POST: " + url, labeldefs);
    }
};


module.exports = Confluence;