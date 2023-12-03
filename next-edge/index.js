'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var request = require('request');
var cookie = require('cookie');
var parse = require('set-cookie-parser');
var buffer = require('buffer');
var istextorbinary = require('istextorbinary');
var tldjs = require('tldjs');
var getConfig = require('next/config');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var request__default = /*#__PURE__*/_interopDefaultLegacy(request);
var parse__default = /*#__PURE__*/_interopDefaultLegacy(parse);
var tldjs__default = /*#__PURE__*/_interopDefaultLegacy(tldjs);
var getConfig__default = /*#__PURE__*/_interopDefaultLegacy(getConfig);

const { basePath } = getConfig__default['default']() || { basePath: "" };
function filterRequestHeaders(headers, forwardAdditionalHeaders) {
  const defaultForwardedHeaders = [
    "accept",
    "accept-charset",
    "accept-encoding",
    "accept-language",
    "authorization",
    "cache-control",
    "content-type",
    "cookie",
    "host",
    "user-agent",
    "referer"
  ];
  return Object.fromEntries(Object.entries(headers).filter(([key]) => defaultForwardedHeaders.includes(key) || (forwardAdditionalHeaders ?? []).includes(key)));
}
const encode = (v) => v;
function getBaseUrl(options) {
  let baseUrl = options.fallbackToPlayground ? "https://playground.projects.oryapis.com/" : "";
  if (process.env.ORY_SDK_URL) {
    baseUrl = process.env.ORY_SDK_URL;
  }
  if (process.env.ORY_KRATOS_URL) {
    baseUrl = process.env.ORY_KRATOS_URL;
  }
  if (process.env.ORY_SDK_URL && process.env.ORY_KRATOS_URL) {
    throw new Error("Only one of ORY_SDK_URL or ORY_KRATOS_URL can be set.");
  }
  if (options.apiBaseUrlOverride) {
    baseUrl = options.apiBaseUrlOverride;
  }
  return baseUrl.replace(/\/$/, "");
}
const config = {
  api: {
    bodyParser: false
  }
};
function createApiHandler(options) {
  const baseUrl = getBaseUrl(options);
  return (req, res) => {
    const { paths, ...query } = req.query;
    const search = new URLSearchParams();
    Object.keys(query).forEach((key) => {
      search.set(key, String(query[key]));
    });
    const path = Array.isArray(paths) ? paths.join("/") : paths;
    const url = `${baseUrl}/${path}?${search.toString()}`;
    if (path === "ui/welcome") {
      res.redirect(303, `../../..${basePath.startsWith("/") ? basePath : "/"}`);
      return;
    }
    const isTls = req.protocol === "https:" || req.secure || req.headers["x-forwarded-proto"] === "https";
    req.headers = filterRequestHeaders(req.headers, options.forwardAdditionalHeaders);
    req.headers["X-Ory-Base-URL-Rewrite"] = "false";
    req.headers["Ory-Base-URL-Rewrite"] = "false";
    req.headers["Ory-No-Custom-Domain-Redirect"] = "true";
    let buf = buffer.Buffer.alloc(0);
    let code = 0;
    let headers;
    return new Promise((resolve) => {
      req.pipe(request__default['default'](url, {
        followAllRedirects: false,
        followRedirect: false,
        gzip: true,
        json: false
      })).on("response", (res2) => {
        if (res2.headers.location) {
          if (res2.headers.location.indexOf(baseUrl) === 0) {
            res2.headers.location = res2.headers.location.replace(baseUrl, `${basePath}/api/.ory`);
          } else if (res2.headers.location.indexOf(`${basePath}/api/kratos/public/`) === 0 || res2.headers.location.indexOf(`${basePath}/self-service/`) === 0 || res2.headers.location.indexOf(`${basePath}/ui/`) === 0) {
            res2.headers.location = `${basePath}/api/.ory` + res2.headers.location;
          }
        }
        const secure = options.forceCookieSecure === void 0 ? isTls : options.forceCookieSecure;
        const forwarded = req.rawHeaders.findIndex((h) => h.toLowerCase() === "x-forwarded-host");
        const host = forwarded > -1 ? req.rawHeaders[forwarded + 1] : req.headers.host;
        const domain = guessCookieDomain(host, options);
        res2.headers["set-cookie"] = parse__default['default'](res2).map((cookie) => ({
          ...cookie,
          domain,
          secure,
          encode
        })).map(({ value, name, ...options2 }) => cookie.serialize(name, value, options2));
        headers = res2.headers;
        code = res2.statusCode;
      }).on("data", (chunk) => {
        buf = buffer.Buffer.concat([buf, chunk], buf.length + chunk.length);
      }).on("end", () => {
        delete headers["transfer-encoding"];
        delete headers["content-encoding"];
        delete headers["content-length"];
        Object.keys(headers).forEach((key) => {
          res.setHeader(key, headers[key]);
        });
        res.status(code);
        if (buf.length > 0) {
          if (istextorbinary.isText(null, buf)) {
            res.send(buf.toString("utf-8").replace(new RegExp(baseUrl, "g"), `${basePath}/api/.ory`));
          } else {
            res.write(buf);
          }
        }
        res.end();
        resolve();
      });
    });
  };
}
function guessCookieDomain(url, options) {
  if (!url || options.forceCookieDomain) {
    return options.forceCookieDomain;
  }
  if (options.dontUseTldForCookieDomain) {
    return void 0;
  }
  const parsed = tldjs__default['default'].parse(url || "");
  if (!parsed.isValid || parsed.isIp) {
    return void 0;
  }
  if (!parsed.domain) {
    return parsed.hostname;
  }
  return parsed.domain;
}

exports.config = config;
exports.createApiHandler = createApiHandler;
exports.filterRequestHeaders = filterRequestHeaders;
exports.guessCookieDomain = guessCookieDomain;
//# sourceMappingURL=index.js.map
