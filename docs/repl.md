# REPL

This is the Node REPL, with some additions:
* zx/globals are imported (so "$" / others are available as a globals)
  * Note: $.verbose is set to false by default
* Quick shell command
  * Prefix a command with "$" to run in shell, e.g.
  * $ pwd
  * $ ls
* "Shell-mode"
  * Type ".sh" to enter "shell-mode"
  * Type ".js" to exit "shell-mode"

```js
$ zx
```
