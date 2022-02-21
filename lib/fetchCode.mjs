import { join } from "path";
import { createHash } from 'crypto';
import { ensureDirSync } from "fs-extra"
import { readFileSync, writeFileSync } from 'fs';

import { default as nodeFetch } from 'node-fetch';
import base32Encode from 'base32-encode';

ensureDirSync(getCacheDir());

export default async function fetchCode(url = "", verbose = false) {
  if(verbose) {
    var t1 = performance.now();
  }

  let response;
  if(url.startsWith("file:")) {
    response = responseFromFile(url);
  } else {

    // This is like "staleWhileRevalidate"
    // If URL is not in cache, responseFromCache will return a rejected Promise, 
    // and Promise.any() will wait for the responseFromNetwork.
    // If URL is cached, Promise.any() will use that response (but still run 
    // responseFromNetwork(), which can update the cache if needed)
    //
    response = await Promise.any([
      responseFromCache(url), 
      responseFromNetwork(url)
    ]);
  }

  if (response.ok) {
    const text = response.text() || "";
    if(verbose) {
      const ms = Math.round(performance.now() - t1);
      console.log(`${url} ${response.status} ${text.length} ${ms}ms`);
    }
    return text;
  } else {
    throw new Error(
      `Error fetching ${url}: ${response.statusText}`,
    );
  }
}

// The return value from each of these is a pseudo-Response object
// Note: .text() method is synchronous in the returned object
// Note: .status attribute is overridden to a string for responseFromFile / responseFromCache
// for the purposes of debugging / verbose output
//
function responseFromFile(url = "") {
  return {
    ok: true,
    status: "(file)",
    text: () => {
      return readFileSync(url.slice(7), "utf-8");
    }
  }
}

function responseFromCache(url = "") {
  const { file } = getMetadata(url) || {};
  if(!file) return Promise.reject();
  return {
    ok: true,
    status: "(cache)",
    text: () => {
      return readFileSync(file, "utf-8");
    }
  }
}

function responseFromNetwork(url = "") {
  const init = {};
  const metadata = getMetadata(url);
  if(metadata) {
    init.headers = getRequestHeaders(metadata);
  }

  return nodeFetch(url, init).then(async response => {
    response = await parseResponse(response);
    if(response.ok) {
      writeToCache(url, response);
    }
    return response;
  });

  // If we have metadata.headers from a previous successful
  // response, then use the "etag" and "last-modified" headers
  // in this next request. Since we are likely hitting CDN, these
  // headers are likely to be available, and we will get a lot
  // of 304's instead of full 200's
  //
  function getRequestHeaders({ headers = {} }) {
    const request_headers = {};
    if(headers["etag"]) {
      request_headers["if-none-match"] = headers["etag"];
    }
    if(headers["last-modified"]) {
      request_headers["if-modified-since"] = headers["last-modified"];
    }
    return request_headers;
  }

  // node-fetch seems to have some issues with Response.clone(). 
  // https://github.com/node-fetch/node-fetch/issues/1131
  //
  // The object returned here can have it's .text() consumed multiple times.
  //
  async function parseResponse(response) {
    let text;
    try {
      text = await response.text();
    } catch {
      text = "";
    }
    const headers = {};
    for(const [ key, val ] of response.headers.entries()) {
      headers[key] = val;
    }
    const { url, status, statusText, ok } = response;

    return {
      text: () => { return text },
      headers, url, status, statusText, ok
    }
  }

  // I guess we could write all the response to a single .json file
  // (i.e. put the .text() into the JSON); but it would make the
  // reading of metadata.headers a bit wasteful (as would need to read
  // and parse all that content every time...)
  //
  function writeToCache(url, response = {}) {
    const { ok, headers } = response;
    if(!ok) return;
  
    const hash = generateHash(url);
    const file = fullpath(hash);
    const metadata_file = `${file}.json`;
  
    writeFileSync(file, response.text());
    writeFileSync(metadata_file, JSON.stringify({
      url, file, headers
    }));
  }
}

function generateHash(url = "") {
  const buffer = createHash("sha256").update(url, "utf-8").digest();
  return base32Encode(buffer, "RFC4648", {
    padding: false
  });
}

function getMetadata(url = "") {
  try {
    const hash = generateHash(url);
    return JSON.parse(readFileSync(fullpath(`${hash}.json`), "utf-8"));
  } catch {
    return null;
  }
}

function fullpath(file = "") {
  return join(getCacheDir(), file);
}

function getCacheDir() {

  if(process.platform === "win32") {

    // C:\Users\<username>\AppData\Local\Temp\zx\fetch
    //
    return join(process.env.TEMP, "zx", "fetch");
  } else {

    // /home/<username>/.cache/zx/fetch
    //
    return join(process.env.HOME, ".cache", "zx", "fetch");
  }
}