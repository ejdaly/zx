import repl from "repl";
import "zx/globals";

export default function replStart() {
  let _shmode = false;

  const replServer = repl.start({
    prompt: 'js> ',
    tabSize: 2
  });
  const evalfunc = replServer.eval;
  replServer.eval = async function myEval(cmd, context, filename, callback) {

    if(_shmode) {
      cmd = `var { stdout, stderr, exitCode } = await $\`${cmd}\``;
    } else if(cmd.startsWith("$")) {
      cmd = `var { stdout, stderr, exitCode } = await $\`${cmd.slice(1).trim()}\``;
    }
    return evalfunc(cmd, context, filename, callback);
  }
  
  // const completerfunc = replServer.completer;
  // replServer.completer = async function(line, callback) {
  //   if(_shmode) {
  //     if(!line) return [[], line];
  //     const completions = 'echo ls pwd'.split(' ');
  //     const hits = completions.filter((c) => c.startsWith(line));
  //     // Show all completions if none found
  //     return callback(null, [hits.length ? hits : completions, line]);
  //     // return [["echo", "ls", "pwd"], line]
  //   } else {

  //   }
  //   return completerfunc(line, callback);
  // }
  
  replServer.defineCommand("sh", {
    help: "sh",
    async action() {
      _shmode = true;
      replServer.setPrompt("sh$ ");
      this.clearBufferedCommand();
      this.displayPrompt();
    }
  });
  
  replServer.defineCommand("js", {
    help: "js",
    async action() {
      _shmode = false;
      replServer.setPrompt("js> ");
      this.clearBufferedCommand();
      this.displayPrompt();
    }
  });
}
