var request = require('superagent');

var config = {};

function Confluence(config) {
    
    if (!(this instanceof Confluence)) return new Confluence(config);

    if (!config) {
        throw new Error("Confluence module expects a config object.");
    }
    else if (!config.username || ! config.password) {
        throw new Error("Confluence module expects a config object with both a username and password.");
    }
    else if (!config.baseUrl) {
        throw new Error("Confluence module expects a config object with a baseUrl.");
    }

    this.config = config;
}

/**
 * Get space home page.
 *
 * @param {string} space
 * @param {Function} callback
 */
Confluence.prototype.getSpaceHomePage = function(space, callback) {
    var config = this.config;

    request
        .get(config.baseUrl + "/rest/api/space?spaceKey=" + space)
        .auth(config.username, config.password)
        .end(function(err, res){
            if (err) {
                callback(err);
            }
            else {
                try {
                    var url = config.baseUrl + res.body.results[0]._expandable.homepage;
                    request
                        .get(url)
                        .auth(config.username, config.password)
                        .end(function(err, res){
                            callback(err, res.body);
                        });
                        
                        if (config.debug) {
                            console.log("GET: " + url);
                        }                        
                }
                catch (e) {
                    callback("Can't find space home page. " + e.message, res);
                }
            }
        });

};

/**
 * Get stored content for a specific space and page title.
 *
 * @param {string} id
 * @param {Function} callback
 */
Confluence.prototype.getContentById = function(id, expand, callback) {
    
    if (expand === undefined) {
        expand = "version,body.view";
    }
    
    var url = this.config.baseUrl + "/rest/api/content/" + id + "?expand=" + expand;

    request
        .get(url)
        .auth(this.config.username, this.config.password)
        .end(function(err, res){
           callback(err, res.body);
        });
        
    if (this.config.debug) {
        console.log("GET: " + url);
    }
};

/**
 * Get stored content for a specific space and page title.
 *
 * @param {string} space
 * @param {string} title
 * @param {Function} callback
 */
Confluence.prototype.getContentByPageTitle = function(space, title, expand, callback) {
    
    if (expand === undefined) {
        expand = "version,body.view";
    }    
        
    var query =
        "?spaceKey=" + space +
        "&title=" + title +
        "&expand=" + expand;
        
    var url = this.config.baseUrl + "/rest/api/content" + query;

    request
        .get(url)
        .auth(this.config.username, this.config.password)
        .end(function(err, res){
            callback(err, res.body);
        });
        
    if (this.config.debug) {
        console.log("GET: " + url);
    }

};

/**
 * Post content to a new page.
 *
 * @param {string} space
 * @param {string} title
 * @param {string} content
 * @param {number} parentId - A null value will cause the page to be added under the space's home page
 * @param {Function} callback
 */
Confluence.prototype.postContent = function(space, title, content, parentId, callback) {
    
    var config = this.config;
    
    var page = {
        "type": "page",
        "title": title,
        "space": {
            "key": space
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

    function createPage() {
        
        var url = config.baseUrl + "/rest/api/content";
        
        request
            .post(url)
            .auth(config.username, config.password)
            .type('json')
            .send(page)
            .end(function(err, res){
                callback(err, res.body);
            });
            
        if (config.debug) {
            console.log("POST: " + url);
        }            
    }

    if (!parentId) {
        this.getSpaceHomePage(space, function(err, res) {
            if (err) callback(err);

            else if (!res || !res.id) {
                callback("Can't find space home page.");
            }
            else {
                page.ancestors[0].id = res.id;
                createPage();
            }
        });
    }
    else {
        page.ancestors[0].id = parentId;
        createPage();
    }

};

/**
 * Put/update stored content for a page.
 *
 * @param {string} space
 * @param {string} id
 * @param {number} version
 * @param {string} title
 * @param {string} content
 * @param {Function} callback
 */
Confluence.prototype.putContent = function(space, id, version, title, content, minorEdit, callback) {
    
    if (minorEdit === undefined) {
        minorEdit = true;
    }
    
    var page = {
        "id": id,
        "type": "page",
        "title": title,
        "space": {
            "key": space
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
    
    var url = this.config.baseUrl + "/rest/api/content/" + id + "?expand=version";

    request
        .put(url)
        .auth(this.config.username, this.config.password)
        .type('json')
        .send(page)
        .end(function(err, res){
            callback(err, res.body);
        });
        
        if (config.debug) {
            console.log("PUT: " + url);
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
    
    var url = this.config.baseUrl + "/rest/api/content/" + id + "/label";

    request
        .post(url)
        .auth(this.config.username, this.config.password)
        .send(labeldefs)
        .end(function(err, res){
            callback(err, res);
        });

        if (this.config.debug) {
            console.log("POST: " + url);
        }
};


module.exports = Confluence;