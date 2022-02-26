# Dynamic Import

This is useful is using the standalone build, on a system that doesn't have other Node tools, such as NPM.

"$.import()" function will download and import the specified module (by URL).

    
NOTE: It's likely Node will have native support for dynamic imports in the not-too-distant future. The implementation here is dependant on the "experimental-vm-modules" flag currently available in Node v16. The implementation here also caches modules on download; which may / may not be part of the native Node implementation.

## Credits

Most of the implementation logic here is from: 
* https://github.com/mfellner/react-micro-frontends/tree/main/packages/dynamic-import
* https://dev.to/mxfellner/dynamic-import-with-http-urls-in-node-js-7og

## Examples

```js
const { VERSION } = await $.import("https://cdn.skypack.dev/lodash");
console.log(`Lodash: ${VERSION}`);
```

```js
// This is the default "baseUrl" to enable shorter import syntaxes
// The imported module here will be the same as above...
//
// $.import.baseUrl = "https://cdn.skypack.dev/";
//
const { random, VERSION } = await $.import("lodash");
console.log(`Lodash: ${VERSION}`);

const { begoo } = await $.import("begoo@v2");
console.log(begoo(`Lucky number ${random(0, 100)}!! 😸`));
```

```js
// You can also configure the sources (e.g. CDN) & versions
// separately.
//
// The syntax here is more like a package.json, but you need
// to check the documentation of the specific CDN to understand
// what they support (most seem to support semver-like syntax)
//
// e.g.:
// https://docs.skypack.dev/skypack-cdn/api-reference/lookup-urls#lookup-by-package-+-version-range-semver
//
console.log(chalk.blue(`\nImporting lodash from esm.sh`));
$.import.map = {
  lodash: "https://esm.sh/lodash@^3"
};

// There is a separate "verbose" setting specifically for $.import, which
// will output what files are actually being downloaded, and whether the result
// was served from the network or from the cache
//
$.import.verbose = true;
const { default: { VERSION } } = await $.import("lodash");
$.import.verbose = false;
console.log(`Lodash: ${VERSION}`);
```