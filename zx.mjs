#!/usr/bin/env node

// Copyright 2021 Google LLC
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     https://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {basename, dirname, extname, join, parse, resolve} from 'path'
import {tmpdir} from 'os'
import fs from 'fs-extra'
import {createRequire} from 'module'
import url from 'url'
import {$, fetch, ProcessOutput, argv} from './index.mjs'

// @ejdaly -
// tsCompile is a simple programmatic version of "npx tsc..." (since, we
// won't have "npx" or "tsc" in the standalone zx-bin; so we import "typescript"
// and use programatically instead...)
//
import tsCompile from './lib/tsCompile.mjs'

// @ejdaly - 
// repl.mjs has a very simple REPL interface, that has zx/globals.mjs imported.
// So, e.g. "$" will be available in the REPL
//
import replStart from './lib/repl.mjs'

// @ejdaly - 
// This adds the ability to import modules from URLs. As of node v16.14.0, it is not
// possible to do this automatically. The dynamicImport.mjs fetches the module and
// executes it on the fly. It has some basic caching functionality (using eTags:
// if-none-match, if-modified-since headers; which should be available on CDN-fetched
// modules)
//
import dynamicImport from './lib/dynamicImport.mjs'

import './globals.mjs'

$.import = dynamicImport

// @ejdaly - Rollup will fail on the top-level await, so just wrap
// this in an async IIFE...
//
main();
async function main() {
  try {
    if (['--version', '-v', '-V'].includes(process.argv[2] || '')) {
  
      // @ejdaly - added a printVersion() function, which includes Node version.
      // Having Node version is more useful if it's standalone build; but probably
      // somewhat useful regardless
      //
      // console.log(`zx version ${createRequire(import.meta.url)('./package.json').version}`)
      printVersion()
      process.exit(0)
    }

    let firstArg = process.argv.slice(2).find(a => !a.startsWith('--'))
  
    // @ejdaly - invoke the REPL if no args
    //
    if (process.argv.length === 2) {
      printVersion()
      replStart()
    } else if (typeof firstArg === 'undefined' || firstArg === '-') {
      let ok = await scriptFromStdin()
      if (!ok) {
        printUsage()
        process.exit(2)
      }
    } else if (firstArg.startsWith('http://') || firstArg.startsWith('https://')) {
      await scriptFromHttp(firstArg)
    } else {
      let filepath
      if (firstArg.startsWith('/')) {
        filepath = firstArg
      } else if (firstArg.startsWith('file:///')) {
        filepath = url.fileURLToPath(firstArg)
      } else {
        filepath = resolve(firstArg)
      }
      await importPath(filepath)
    }
  
  } catch (p) {
    if (p instanceof ProcessOutput) {
      console.error('Error: ' + p.message)
      process.exit(1)
    } else {
      throw p
    }
  }
}

async function scriptFromStdin() {
  let script = ''
  if (!process.stdin.isTTY) {
    process.stdin.setEncoding('utf8')
    for await (const chunk of process.stdin) {
      script += chunk
    }

    if (script.length > 0) {
      let filepath = join(
        tmpdir(),
        Math.random().toString(36).substr(2) + '.mjs'
      )
      await fs.mkdtemp(filepath)
      await writeAndImport(script, filepath, join(process.cwd(), 'stdin.mjs'))
      return true
    }
  }
  return false
}

async function scriptFromHttp(remote) {
  let res = await fetch(remote)
  if (!res.ok) {
    console.error(`Error: Can't get ${remote}`)
    process.exit(1)
  }
  let script = await res.text()
  let filename = new URL(remote).pathname
  let filepath = join(tmpdir(), basename(filename))
  await fs.mkdtemp(filepath)
  await writeAndImport(script, filepath, join(process.cwd(), basename(filename)))
}

async function writeAndImport(script, filepath, origin = filepath) {
  await fs.writeFile(filepath, script)

  // @ejdaly - I think this is a race condition; the file may get removed before
  // being imported... (I haven't seen this happen when using "node zx.mjs", but have
  // seen issues when using the standalone zx binary directly...)
  //
  // let wait = importPath(filepath, origin)
  // await fs.rm(filepath)
  // await wait
  return importPath(filepath, origin).then((mod) => {
    fs.rm(filepath); 
    return mod; 
  });
}

async function importPath(filepath, origin = filepath) {
  let ext = extname(filepath)
  if (ext === '') {
    return await writeAndImport(
      await fs.readFile(filepath),
      join(dirname(filepath), basename(filepath) + '.mjs'),
      origin,
    )
  }
  if (ext === '.md') {
    return await writeAndImport(
      transformMarkdown((await fs.readFile(filepath)).toString()),
      join(dirname(filepath), basename(filepath) + '.mjs'),
      origin,
    )
  }
  if (ext === '.ts') {
    let {dir, name} = parse(filepath)
    let outFile = join(dir, name + '.cjs')

    // @ejdaly - swapping out the command line typescript compilation (tsc), for
    // the programmatic version (in tsCompile.mjs)
    //
    // await compile(filepath)
    tsCompile(filepath)

    await fs.rename(join(dir, name + '.js'), outFile)
    let wait = importPath(outFile, filepath)
    await fs.rm(outFile)
    return wait
  }
  let __filename = resolve(origin)
  let __dirname = dirname(__filename)
  let require = createRequire(origin)
  Object.assign(global, {__filename, __dirname, require})
  await import(url.pathToFileURL(filepath))
}

function transformMarkdown(source) {
  let output = []
  let state = 'root'
  let prevLineIsEmpty = true
  for (let line of source.split('\n')) {
    switch (state) {
      case 'root':
        if (/^( {4}|\t)/.test(line) && prevLineIsEmpty) {
          output.push(line)
          state = 'tab'
        } else if (/^```(js|javascript)$/.test(line)) {
          output.push('')
          state = 'js'
        } else if (/^```(sh|bash)$/.test(line)) {
          output.push('await $`')
          state = 'bash'
        } else if (/^```.*$/.test(line)) {
          output.push('')
          state = 'other'
        } else {
          prevLineIsEmpty = line === ''
          output.push('// ' + line)
        }
        break
      case 'tab':
        if (/^( +|\t)/.test(line)) {
          output.push(line)
        } else if (line === '') {
          output.push('')
        } else {
          output.push('// ' + line)
          state = 'root'
        }
        break
      case 'js':
        if (/^```$/.test(line)) {
          output.push('')
          state = 'root'
        } else {
          output.push(line)
        }
        break
      case 'bash':
        if (/^```$/.test(line)) {
          output.push('`')
          state = 'root'
        } else {
          output.push(line)
        }
        break
      case 'other':
        if (/^```$/.test(line)) {
          output.push('')
          state = 'root'
        } else {
          output.push('// ' + line)
        }
        break
    }
  }
  return output.join('\n')
}

// @ejdaly - this is no longer used (replaced by tsCompile.mjs)
//
// async function compile(input) {
//   let v = $.verbose
//   $.verbose = false
//   let tsc = $`npm_config_yes=true npx -p typescript tsc --target esnext --lib esnext --module commonjs --moduleResolution node ${input}`
//   $.verbose = v
//   let i = 0,
//     spinner = setInterval(() => process.stdout.write(`  ${'⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'[i++ % 10]}\r`), 100)
//   try {
//     await tsc
//   } catch (err) {
//     console.error(err.toString())
//     process.exit(1)
//   }
//   clearInterval(spinner)
//   process.stdout.write('   \r')
// }

function printUsage() {
  console.log(`
 ${chalk.bgGreenBright.black(' ZX ')}

 Usage:
   zx [options] <script>
 
 Options:
   --quiet            : don't echo commands
   --shell=<path>     : custom shell binary
   --prefix=<command> : prefix all commands
`)
}

// @ejdaly - adding this to include Node version
//
function printVersion() {
  const v = $.verbose
  $.verbose = false

  const version = {
    zx: createRequire(import.meta.url)('./package.json').version,
    node: process.version
  };
  console.log(`zx version ${version.zx} (node ${version.node})`)

  $.verbose = v
}