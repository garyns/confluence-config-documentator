# Confdoc Change Log
### 1.1.37
* URL encoding of Confluence titles and space keys so characters such as "&" do not throw an exception.
### 1.2.0
* *timeout* parameter added to configuration for `confwatch`. After a watched file is changed, this is the time in seconds before the file is uploaded to Confluence. Any change to the file within this time will reset the timer. This means you can perform an edit-save-test-edit-save-test cycle without incurring multiple uploads to Confluence.