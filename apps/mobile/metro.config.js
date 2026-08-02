// Metro does not understand a monorepo out of the box: it only watches this
// folder and only resolves modules from ./node_modules. Both have to be widened
// or every `@double-a/*` import fails to resolve at bundle time.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the workspace so edits in packages/ trigger a rebuild.
config.watchFolders = [workspaceRoot];

// 2. Resolve from this app first, then the hoisted root store.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Do not walk further up the filesystem looking for modules.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
