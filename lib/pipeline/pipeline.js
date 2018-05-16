const fs = require('../core/fs.js');
const async = require('async');
const ProcessLauncher = require('../process/processLauncher');
const utils = require('../utils/utils.js');
const constants = require('../constants');

require("babel-preset-react");
require("babel-preset-es2015");
require("babel-preset-es2016");
require("babel-preset-es2017");

class Pipeline {

  constructor(options) {
    this.buildDir = options.buildDir;
    this.contractsFiles = options.contractsFiles;
    this.assetFiles = options.assetFiles;
    this.events = options.events;
    this.logger = options.logger;
    this.normalizeInput = options.normalizeInput;
    this.plugins = options.plugins;
    this.pipelinePlugins = this.plugins.getPluginsFor('pipeline');
  }

  build(abi, contractsJSON, path, callback) {
    let self = this;
    const importsList = {};

    async.waterfall([
      function buildTheContracts(next) {
        self.buildContracts(contractsJSON, next);
      },
      function buildWeb3(next) {
        self.buildWeb3JS(next);
      },
      function createImportList(next) {
        importsList["Embark/EmbarkJS"] = fs.dappPath(".embark", 'embark.js');
        importsList["Embark/web3"] = fs.dappPath(".embark", 'web3_instance.js');

        self.plugins.getPluginsProperty('imports', 'imports').forEach(function (importObject) {
          let [importName, importLocation] = importObject;
          importsList[importName] = importLocation;
        });

        next();
      },
      function writeContracts(next) {
        async.each(Object.keys(contractsJSON), (contractName, eachCb) => {
          self.buildContractJS(contractName, (err, contractCode) => {
            let filePath = fs.dappPath(".embark", contractName + '.js');
            importsList["Embark/contracts/" + contractName] = filePath;
            fs.writeFile(filePath, contractCode, eachCb);
          });
        }, next);
      },
      function assetFileWrite(next) {
        async.eachOf(self.assetFiles, function (files, targetFile, cb) {
            async.map(files,
              function (file, fileCb) {
                self.logger.trace("reading " + file.filename);

                // Not a JS file
                if (file.filename.indexOf('.js') < 0) {
                  return file.content(function (fileContent) {
                    self.runPlugins(file, fileContent, fileCb);
                  });
                }

                // JS files
                async.waterfall([
                  function runWebpack(next) {
                    const webpackProcess = new ProcessLauncher({
                      modulePath: utils.joinPath(__dirname, 'webpackProcess.js'),
                      logger: self.logger,
                      normalizeInput: self.normalizeInput
                    });
                    console.log('Starting process');
                    webpackProcess.send({action: constants.pipeline.init, options: {}});
                    webpackProcess.send({action: constants.pipeline.build, file, importsList});

                    webpackProcess.subscribeTo('result', constants.pipeline.built, (msg) => {
                      webpackProcess.disconnect();
                      return next(msg.error);
                    });
                  },

                  function readFile(next) {
                    fs.readFile('./.embark/' + file.filename, (err, data) => {
                      if (err) {
                        return next(err);
                      }
                      next(null, data.toString());
                    });
                  },

                  function runPluginsOnContent(fileContent, next) {
                    self.runPlugins(file, fileContent, next);
                  }

                ], function (err, contentFile) {
                  if (err) {
                    self.logger.error(err);
                    return fileCb(err);
                  }

                  fileCb(null, contentFile);
                });
              },
              function (err, contentFiles) {
                if (err) {
                  self.logger.error(__('errors found while generating') + ' ' + targetFile);
                }
                let dir = targetFile.split('/').slice(0, -1).join('/');
                self.logger.trace("creating dir " + self.buildDir + dir);
                fs.mkdirpSync(self.buildDir + dir);

                // if it's a directory
                if (targetFile.slice(-1) === '/' || targetFile.indexOf('.') === -1) {
                  let targetDir = targetFile;

                  if (targetDir.slice(-1) !== '/') {
                    targetDir = targetDir + '/';
                  }

                  async.each(contentFiles, function (file, mapCb) {
                    let filename = file.filename.replace(file.basedir + '/', '');
                    self.logger.info("writing file " + (self.buildDir + targetDir + filename).bold.dim);

                    fs.copy(file.path, self.buildDir + targetDir + filename, {overwrite: true}, mapCb);
                  }, cb);
                  return;
                }

                let content = contentFiles.map(function (file) {
                  if (file === undefined) {
                    return "";
                  }
                  return file.content;
                }).join("\n");

                self.logger.info(__("writing file") + " " + (self.buildDir + targetFile).bold.dim);
                fs.writeFile(self.buildDir + targetFile, content, cb);
              }
            );
          },
          next);
      }
    ], callback);
  }

  runPlugins(file, fileContent, fileCb) {
    const self = this;
    if (self.pipelinePlugins.length <= 0) {
      return fileCb(null, {content: fileContent, filename: file.filename, path: file.path, basedir: file.basedir, modified: true});
    }
    async.eachSeries(self.pipelinePlugins,
      function(plugin, pluginCB) {
        if (file.options && file.options.skipPipeline) {
          return pluginCB();
        }

        fileContent = plugin.runPipeline({targetFile: file.filename, source: fileContent});
        file.modified = true;
        pluginCB();
      },
      function (err) {
        if (err) {
          self.logger.error(err.message);
        }
        return fileCb(null, {content: fileContent, filename: file.filename, path: file.path, basedir: file.basedir, modified: true});
      }
    );
  }

  buildContracts(contractsJSON, callback) {
    fs.mkdirp(fs.dappPath(this.buildDir, 'contracts'), (err) => {
      if (err) {
        return callback(err);
      }
      async.each(Object.keys(contractsJSON), (className, eachCb) => {
        let contract = contractsJSON[className];
        fs.writeJson(fs.dappPath(this.buildDir, 'contracts', className + ".json"), contract, {spaces: 2}, eachCb);
      }, callback);
    });
  }

  buildContractJS(contractName, callback) {
    fs.readFile(fs.dappPath(this.buildDir, 'contracts', contractName + '.json'), (err, contractJSON) => {
      if (err) {
        return callback(err);
      }
      contractJSON = contractJSON.toString();

      let contractCode = "";
      contractCode += "import web3 from 'Embark/web3';\n";
      contractCode += "import EmbarkJS from 'Embark/EmbarkJS';\n";
      contractCode += "let " + contractName + "JSONConfig = " + contractJSON + ";\n";
      contractCode += "let " + contractName + " = new EmbarkJS.Contract(" + contractName + "JSONConfig);\n";

      contractCode += "\n__embarkContext.execWhenReady(function() {\n";
      contractCode += "\n" + contractName + ".setProvider(web3.currentProvider);\n";
      contractCode += "\n" + contractName + ".options.from = web3.eth.defaultAccount;\n";
      contractCode += "\n});\n";

      contractCode += "export default " + contractName + ";\n";
      callback(null, contractCode);
    });
  }

  buildWeb3JS(cb) {
    const self = this;
    let code = "";

    async.waterfall([
      function getWeb3Location(next) {
        self.events.request("version:get:web3", function(web3Version) {
          if (web3Version === "1.0.0-beta") {
            return next(null, utils.joinPath(fs.embarkPath("js/web3-1.0.min.js")));
          } else {
            self.events.request("version:getPackageLocation", "web3", web3Version, function(err, location) {
              return next(null, fs.dappPath(location));
            });
          }
        });
      },
      function getImports(web3Location, next) {
        web3Location = web3Location.replace(/\\/g, '/'); // Import paths must always have forward slashes
        code += "\nimport Web3 from '" + web3Location + "';\n";

        code += "\n if (typeof web3 !== 'undefined') {";
        code += "\n } else {";
        code += "\n var web3 = new Web3();\n";
        code += "\n }";

        self.events.request('provider-code', function(providerCode)  {
          code += providerCode;
          code += "\nglobal.__embarkContext = __mainContext.__loadManagerInstance;\n";
          code += "\nwindow.web3 = web3;\n";
          code += "\nexport default web3;\n";
          next();
        });
      },
      function makeDirectory(next) {
        fs.mkdirp(fs.dappPath(".embark"), (err, _result) => {
          next(err);
        });
      },
      function writeFile(next) {
        fs.writeFile(fs.dappPath(".embark", 'web3_instance.js'), code, next);
      }
    ], cb);
  }
}

module.exports = Pipeline;
