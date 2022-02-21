import { rollup } from "rollup";
import commonjs from "@rollup/plugin-commonjs";
import node_resolve from "@rollup/plugin-node-resolve";
import ignore from "rollup-plugin-ignore";
import { terser } from "rollup-plugin-terser";
import json from "@rollup/plugin-json";

$.verbose = false
console.log(chalk.black.bgYellowBright` BUILD `)
let i = 0,
  spin = () => process.stdout.write(`  ${'⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'[i++ % 10]}\r`),
  stop = (id => () => clearInterval(id))(setInterval(spin, 100))

const rootdir = path.resolve(__dirname, "../..");

await $`rm -rf ${rootdir}/standalone/{build,dist}`;
await $`mkdir -p ${rootdir}/standalone/{build,dist}`;

const inFile = `${rootdir}/zx.mjs`;
const { version } = require(`${rootdir}/package.json`);
const outDir = `${rootdir}/standalone/build`;
const outFile = `${rootdir}/standalone/build/zx-${version}.cjs`;

// First, we bundle zx.mjs into a commonjs module, with all dependencies
//
const bundle = await rollup({
  input: inFile,
  plugins: [
    commonjs(), 
    node_resolve({
      preferBuiltins: false
    }),
    terser(),
    json(),
    rollupSliceFirstline(),
    rollupIgnoreDynamicImport(),
    rollupAddDirectEvalZxNode(),
    ignore(["inspector", "source-map-support"])
  ]
});

await bundle.write({
  file: outFile,
  format: "commonjs"
});

// The virtual filesystem will need package.json (zx.mjs uses package.json to determine version)
// See also: pkg.json
//
await $`cp ${rootdir}/package.json ${outDir}`

// Override the recursive EXECPATH logic in PKG, to allow zx binary to call itself via:
//  await $`zx --version`
// See:
//  https://github.com/vercel/pkg/issues/376
//
let pkgBootstrap = `${rootdir}/node_modules/pkg/prelude/bootstrap.js`;
await $`sed -i 's/opts.env.PKG_EXECPATH = EXECPATH/delete opts.env.PKG_EXECPATH/' ${pkgBootstrap}`;

// See the following for available pkg_args (in particular --targets): https://github.com/vercel/pkg
//
const pkg_args = process.argv.slice(3);

// We bake-in the "experimental-vm-modules" option to allow dynamic import
//
await $`npx pkg --config ${rootdir}/standalone/pkg.json --out-path=${rootdir}/standalone/dist --public --public-packages "*" --no-bytecode --options "experimental-vm-modules,no-warnings" ${pkg_args} ${outFile}`;

stop()
console.log(chalk.black.bgGreenBright` DONE `);

function isZx(moduleId = "") {
  return `${rootdir}/zx.mjs` === moduleId;
}

function isZxIndex(moduleId = "") {
  return `${rootdir}/index.mjs` === moduleId;
}

// Need to slice off the first line (shebang) from zx.mjs
//
function rollupSliceFirstline() {
  return {
    name: 'slice',
    transform(code, moduleId) {
      if(!isZx(moduleId)) return;
      code = code.split('\n').slice(1).join('\n');
      return { code };
    }
  };
}

// We want rollup to ignore the dynamic import in zx.mjs
// See: https://rollupjs.org/guide/en/#renderdynamicimport
//
function rollupIgnoreDynamicImport() {
  return {
    name: 'ignore-dynamic-import',
    renderDynamicImport({ moduleId }) {
      if(!isZx(moduleId)) return;
      return {
        left: 'import(',
        right: ')'
      };
    }
  };
}

// This is functionality that is specific to the standalone binary.
// (otherwise, we could just edit zx/index.mjs)
// In the JS module, these calls will likely work, but should invoke the "zx" / "node" 
// processes based on $PATH. But in the standalone, these calls will invoke the standalone
// zx binary (i.e. the process that is running...), and the node that was used to build the
// zx binary...
//
function rollupAddDirectEvalZxNode() {
  return {
    name: 'add-direct-eval-zx-node',
    transform(code, moduleId) {
      if(!isZxIndex(moduleId)) return;

      code = code.replace(
        "let child = spawn(prefix + cmd, {", 
        `
          if(cmd.startsWith("zx ")) {
            cmd = cmd.replace("zx", process.argv[0]);
          }
      
          if(cmd.startsWith("node ")) {
            cmd = cmd.replace("node", process.argv[0]);
            var PKG_EXECPATH = "PKG_INVOKE_NODEJS";
          }
      
          let child = spawn(prefix + cmd, {
            env: { ...process.env, PKG_EXECPATH },
        `
      );

      return { code };
    }
  };
}