# Standalone Binary

Built using: https://github.com/vercel/pkg

## Releases

There are downloadable standalone binaries available from the Releases. The node version used to build will generally be the latest LTS.

## Installing

Just download the binary into the $PATH, e.g. 

```bash
$ sudo curl -o /usr/local/bin/zx 
```

## Usage

The standalone binary should have feature parity with the standard invokation, so see: [README.md](../README.md) for usage

## Building

using "npm run"
```js
$ npm run build-standalone
```

or directly
```js
$ node zx.mjs standalone/scripts/build.mjs
```

## Customizing the build

You can add PKG build flags (https://github.com/vercel/pkg#usage), e.g.

```js
$ node zx.mjs standalone/scripts/build.mjs --targets node16-linux-arm64,node16-win-arm64
```

See also:
* [standalone/scripts/build.mjs](/standalone/scripts/build.mjs)
* [standalone/pkg.json](/standalone/pkg.json)