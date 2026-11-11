const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const sharedRoot = path.resolve(workspaceRoot, 'packages/shared/src');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;
config.resolver.extraNodeModules = {
  '@picpac/shared': sharedRoot,
};

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@picpac/shared' || moduleName === '@picpac/shared/') {
    return {
      filePath: path.join(sharedRoot, 'index.ts'),
      type: 'sourceFile',
    };
  }

  if (
    context.originModulePath.includes(`${path.sep}packages${path.sep}shared${path.sep}`) &&
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js')
  ) {
    return context.resolveRequest(context, moduleName.replace(/\.js$/, '.ts'), platform);
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
