import { join, parse } from 'path'
import typescript from "typescript";

export default function tsCompile(inputFile) {

  const { dir, name } = parse(inputFile);
  const outputFile = join(dir, name + '.js');

  const options = {
    module: typescript.ModuleKind.CommonJS,
    target: typescript.ScriptTarget.ESNext,
    moduleResolution: typescript.ModuleResolutionKind.NodeJs,
    lib: [ "esnext" ]
  };

  const input = fs.readFileSync(inputFile, "utf-8");
  const output = typescript.transpileModule(input, options).outputText;
  fs.writeFileSync(outputFile, output);
}