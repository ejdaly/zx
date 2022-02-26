# REPL

This is the Node REPL, with some additions:
* zx/globals are imported (so "$" / others are available as a globals)
* Quick shell command
  * Prefix a command with "$ " to run in shell, e.g.
  * $ pwd
  * $ ls
* "Shell-mode"
  * Type ".sh" to enter "shell-mode"
  * Type ".js" to exit "shell-mode"

```js
// Just invoke the zx command with no arguments
//
$ zx
```

```js
// This is the standard NodeJS REPL, with zx imported
//
zx version 4.3.0 (node v16.13.2)

js> let x = 5;
js> let y = x * 2;
js> console.log({ x, y })
   { x: 5, y: 10 }
```

```js
js> await Promise.all([
      $`sleep 1; echo 1`,
      $`sleep 2; echo 2`,
      $`sleep 3; echo 3`,
    ])

$ sleep 1; echo 1
$ sleep 2; echo 2
$ sleep 3; echo 3
1
2
3
[
  ProcessOutput {
    stdout: '1\n',
    stderr: '',
    exitCode: 0
  },
  ProcessOutput {
    stdout: '2\n',
    stderr: '',
    exitCode: 0
  },
  ProcessOutput {
    stdout: '3\n',
    stderr: '',
    exitCode: 0
  }
]
```

```js
// Prefix a command with "$ " to run in shell
// (So the command below is the same as "await $`pwd`")
//
js> $ pwd
/home/ejdaly/Workspace/zx
```

```sh
// Enter "shell mode", 
//
js> .sh
sh$ pwd
/home/ejdaly/Workspace/zx
```

```sh
sh$ whoami
ejdaly
```


```js
// Go back to "js mode"
//
sh$ .js
js> console.log({ x, y })
{ x: 5, y: 10 }
```