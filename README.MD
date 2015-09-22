# Confluence Config Documentator (confdoc)

>A command line utility to help document textual configurations files in Atlassian Confluence.

The name is a mouth full, but the concept behind confdoc is simple - to create and update Confluence pages with the content of a configuration text file (or any text file for that matter).

## Installation

```
  npm install -g confluence-config-documentator
```

## Usage

```
confdoc --server <confluence_server_url> --username <username> --password <password> [--spaceKey <key>] [--parentId <id>] [--pageId <id>] [--title <title>] [--labels <labels>] [--quiet] [--noupgrade]>
```
```
The following options are supported:
  -q, --quiet           	Suspress non-error output
  -v, --verbose         	Verbose output
  -n, --noupgrade       	Suspress new version check
  -s, --server <ARG1>   	Confluence Server URL (mandatory)
  -u, --username <ARG1> 	Confluence Username (mandatory)
  -p, --password <ARG1> 	Confluence Password (mandatory)
  -k, --spaceKey <ARG1> 	Confluence Space Key
  -o, --parentId <ARG1> 	Confluence Parent Page Id (when creating new page. Space root used if not specified)
  -i, --pageId <ARG1>   	Confluence Page Id (if not specified, title will be used to find page.)
  -t, --title <ARG1>    	Confluence Page Title (defaults to hostname:filename)
  -l, --labels <ARG1>   	Add page labels. Comma separated. (multiple)
```

## In-file Usage

You can add tags to files to override the above arguments. This helps make uploading files easier. We'll cover tags in more detail in the examples section.

Supported tags are
```
##Title: <string>
##SpaceKey: <string>
##PageId: <int>
##ParentId: <int>
##Labels: <string, string, ...>
```

### The Tag Prefix (##)

The above examples prefix tags with ##. The tag prefix is actually any two identical characters. So you just use whatever the file's comment syntax is twice, with an optional space. For instance:

An SQL File
```
-- Title: My SQL File
-- ParentId: 323423
...
```

Or an INI file:
```
;;Title: My INI File
;;ParentId: 241234
...
```


## Examples

The examples assume we are executing the commands on a host called myhost.com.

**Example 1**

The following command will create (or update) a page called myhost.com/etc/httpd/conf/httpd.conf in the root of the Confluence Space with key CONF.
```
confdoc --server http://myconfluenceserver.com --username myusername --password mypassword --spaceKey CONF /etc/httpd/conf/httpd.conf
```

**Example 2**

The next example will update the page with id 12333 in space CONF. This page must exist.
```
confdoc --server http://myconfluenceserver.com --username myusername --password mypassword --spaceKey CONF --pageId 12333 /etc/httpd/conf/httpd.conf
```

**Example 3**

This example will create or update a page in space CONF, under the page with id 12344. The page title will be set to "My Apache Config", and will be labeled with apache and myhost.
```
confdoc --server http://myconfluenceserver.com --username myusername --password mypassword --spaceKey CONF --title "My Apache Config" --parentId 12344 --labels "apache, myhost" /etc/httpd/conf/httpd.conf
```
Here is the same example using comment tags in the head of /etc/httpd/conf/httpd.conf
```
##Title: My Apache Config
##SpaceKey: CONF
##ParentId: 12344
##Labels: apache, myhost
...
...
... rest of apache config file  ...
...
...

```
Then:
```
confdoc --server http://myconfluenceserver.com --username myusername --password mypassword /etc/httpd/conf/httpd.conf
```

## Configuration files = {code} marcos
The uploade file is added to a Confluence Page using a {code} macro. The title of the macro is the uploaded file plus a time stamp, Eg "/etc/httpd/conf/httpd.conf (2015-09-23, 6:45:42am)

When updating a page, confdoc looks for a {code} macro with a title matching the file name of the configuration file. If a {code} macro is found, it is updated. Otherwise a new {code} macro is appended to the page. This means you can add your own content to the Confluence Page and it will be perserved.

![Confluence](http://take.ms/bNUq4)


## Free Versioning & Differentials!

Well, it comes with Confluence. When you upload and update your config files in Confluence you can take advantage of Confluence's Page revisions to track changes to your configuration files over time.

## FAQs

**Will confdoc modify my confiration files?**

No. confdoc never modifies the input file.

**How do I use confdoc to add tags (eg ##Title) to my configuration files?**

You need to edit your files manually and add the tags yourself. confdoc never modifies your files.

**I'm getting an error. What can I do?**

Use the `--verbose` option. This can help output more verbose error messages.

**How do I find a Page's Id for use with --parentId or --pageId?**

Edit the page in Confluence. The Page Id is in the address bar.
![Confluence Page Id](http://take.ms/CYLU6)