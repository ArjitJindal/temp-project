/* eslint-disable */
const path = require('path');
const less = require('less');

var FileManager = less.FileManager;

let cache = new Map();

function getNpmFileManager() {
  function NpmFileManager(options) {
    this.options = options || {};
  }

  NpmFileManager.prototype = new FileManager();

  NpmFileManager.prototype.supports = function (filename, currentDirectory, options, environment) {
    return filename.startsWith('~') || currentDirectory.startsWith('~');
  };

  NpmFileManager.prototype.resolve = function (filename, currentDirectory) {
    // filename = filename.replace(this.options.prefix, '');
    return path.join(this.options.nodeModules, filename.substring(1));
  };

  NpmFileManager.prototype.loadFile = async function (
    filename,
    currentDirectory,
    options,
    environment,
  ) {
    try {
      filename = this.resolve(filename, currentDirectory);
    } catch (e) {
      return new PromiseConstructor(function (fullfill, reject) {
        reject(e);
      });
    }
    const cached = cache.get(filename);
    if (cached) {
      return Promise.resolve(cached);
    }
    let result = await FileManager.prototype.loadFile.call(
      this,
      filename,
      '',
      options,
      environment,
    );
    cache.set(filename, result);
    return result;
  };

  NpmFileManager.prototype.loadFileSync = function (
    filename,
    currentDirectory,
    options,
    environment,
  ) {
    try {
      filename = this.resolve(filename, currentDirectory);
    } catch (e) {
      return { error: e };
    }
    return FileManager.prototype.loadFileSync.call(this, filename, '', options, environment);
  };

  NpmFileManager.prototype.tryAppendExtension = function (path, ext) {
    return path;
  };

  NpmFileManager.prototype.tryAppendLessExtension = function (path) {
    return path;
  };

  return NpmFileManager;
}

var NpmFileManager = getNpmFileManager();

function ImportResolverPlugin(options) {
  this.options = options;
  this.npmFileManager = new NpmFileManager(this.options);
}
ImportResolverPlugin.prototype = {
  install: function (less, pluginManager) {
    pluginManager.addFileManager(this.npmFileManager);
  },
};

module.exports = ImportResolverPlugin;
