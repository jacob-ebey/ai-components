/** @type {import('@remix-run/dev').AppConfig} */
export default {
  ignoredRouteFiles: ["**/.*"],
  browserNodeBuiltinsPolyfill: { modules: { crypto: "empty" } },
  serverDependenciesToBundle: ["@uiw/react-textarea-code-editor"],
};
