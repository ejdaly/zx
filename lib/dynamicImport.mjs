// This file is directly from:
//
// https://github.com/mfellner/react-micro-frontends/tree/main/packages/dynamic-import
// Author: "Maximilian Fellner <max.fellner@gmail.com>"
// License: MIT
//
// Good description by the Author:
// https://dev.to/mxfellner/dynamic-import-with-http-urls-in-node-js-7og
//
import fetchCode from "./fetchCode.mjs";
import vm from 'vm';
import { builtinModules } from 'module';

let _baseUrl = "https://cdn.skypack.dev/";
let _importMap = {};
let _verbose = false;

/**
 * @param {URL} url
 * @param {vm.Context} context
 * @returns {Promise<vm.Module>}
 */
async function createModuleFromURL(url, context) {
  const identifier = url.toString();

  if (
    url.protocol === 'http:' ||
    url.protocol === 'https:' ||
    url.protocol === 'file:'
  ) {
    // Download the code (naive implementation!)
    const source = await fetchCode(identifier, _verbose);
    // Instantiate a ES module from raw source code.
    return new vm.SourceTextModule(source, {
      identifier,
      context,
    });
  } else if (url.protocol === 'node:') {
    const imported = await import(identifier);
    const exportNames = Object.keys(imported);

    return new vm.SyntheticModule(
      exportNames,
      function () {
        for (const name of exportNames) {
          this.setExport(name, imported[name]);
        }
      },
      { identifier, context },
    );
  } else {
    // Other possible schemes could be file: and data:
    // See https://nodejs.org/api/esm.html#esm_urls
    throw new Error(
      `Unsupported URL scheme: ${url.protocol}`,
    );
  }
}

/**
 * @typedef {object} ImportMap
 * @property {NodeJS.Dict<string>} imports
 *
 * @param {ImportMap} importMap Import map object.
 * @returns Link function.
 */
async function linkWithImportMap({ imports }) {
  /**
   * @param {string} specifier
   * @param {vm.SourceTextModule} referencingModule
   * @returns {Promise<vm.SourceTextModule>}
   */
  return async function link(specifier, referencingModule) {
    let url;
    if (builtinModules.includes(specifier)) {
      // If the specifier is a bare module specifier for a Node.js builtin,
      // a valid "node:" protocol URL is created for it.
      url = new URL('node:' + specifier);
    } else if (url in imports) {
      // If the specifier is contained in the import map, it is used from there.
      url = new URL(imports[specifier]);
    } else {
      // If the specifier is a bare module specifier, but not contained
      // in the import map, it will be resolved against the parent
      // identifier. E.g., "foo" and "https://cdn.skypack.dev/bar" will
      // resolve to "https://cdn.skypack.dev/foo". Relative specifiers
      // will also be resolved against the parent, as expected.
      url = new URL(
        specifier,
        referencingModule.identifier,
      );
    }
    return createModuleFromURL(
      url,
      referencingModule.context,
    );
  };
}

function hasProto(string = "") {
  return (
    string.startsWith("/") ||
    string.startsWith(".") ||
    string.startsWith("https://") ||
    string.startsWith("http://") ||
    string.startsWith("file://")
  )
}

/**
 * @param {string} url - URL of a source code file.
 * @param {vm.Context} sandbox - Optional execution context.
 * @param {ImportMap} importMap Optional Path to import_map.json file or object.
 * @returns {Promise<any>} Result of the evaluated code.
 */
async function dynamicImport(specifier) {

  let mapped = _importMap[specifier];
  if(mapped) {


    // The general format of CDN URLs is:
    //  https://cdn.com/package@semver
    //
    // (This isn't a rule - but seems to be generally true for cdn.skypack.dev / esm.sh / esm.run)
    //
    // It allows us the convenient syntax (similar to a package.json dependencies specification)
    //
    //    $.import.map = {
    //      lodash: "^4.1.2",
    //      "@aws-sdk/client-dynamodb": "3.52.0"
    //    }
    // 
    if(!hasProto(mapped)) {
      mapped = specifier + "@" + mapped;
    }
    specifier = mapped;
  }

  if(!hasProto(specifier)) {
    specifier = _baseUrl + specifier;
  }

  try {
    return await import(specifier);
  } catch {

    const url = new URL(specifier);

    // Create an execution context that provides global variables.
    const context = vm.createContext();
    // Create the ES module.
    const mod = await createModuleFromURL(url, context);
    // Create a "link" function that uses an optional import map.
    const link = await linkWithImportMap({ imports: _importMap });
    // Resolve additional imports in the module.
    await mod.link(link);
    // Execute any imperative statements in the module's code.
    await mod.evaluate();
    // The namespace includes the exports of the ES module.
    return mod.namespace;
  }
}

Object.defineProperty(dynamicImport, "baseUrl", {
  set: (baseUrl = "") => {
    _baseUrl = baseUrl;
  },
  get: () => {
    return _baseUrl;
  }
});

Object.defineProperty(dynamicImport, "map", {
  set: (importMap = {}) => {
    _importMap = importMap;
  },
  get: () => {
    return _importMap;
  }
});

Object.defineProperty(dynamicImport, "verbose", {
  set: function(verbose = false) {
    _verbose = verbose;
  },
  get: () => {
    return _verbose;
  }
});

export default dynamicImport