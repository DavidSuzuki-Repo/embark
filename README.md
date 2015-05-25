What is embark
======
Embark is a framework that allows you to easily develop and deploy DApps. Embark automatically deploys your contracts and makes them available in your JS code. Embark watches for changes, and if you update a contract, Embark will automatically redeploy the contracts (if needed) and the dapp.

Installation
======
Requirements: geth, solc, node and npm

```Bash
$ npm install -g embark-framework grunt-cli
```

Usage - Demo
======
You can easily create a sample working DApp with the following:

```Bash
$ embark demo
$ cd embark_demo
```
To run the ethereum node for development purposes simply run:

```Bash
$ embark blockchain
```
By default embark blockchain will mine a minimum amount of ether and will only mine when new transactions come in. This is quite usefull to keep a low CPU. The option can be configured at config/blockchain.yml

Then, in another command line:

```Bash
$ embark run
```
This will automatically deploy the contracts, update their JS bindings and deploy your DApp to a local server at http://localhost:8000

Note that if you update your code it will automatically be re-deployed, contracts included. There is no need to restart embark, refreshing the page on the browser will do.

Creating a new DApp
======

```Bash
$ embark new AppName
$ cd AppName
```

DApp Structure
======

```Bash
  app/
  |___ contracts/ #solidity contracts
  |___ html/
  |___ css/
  |___ js/
  config/
    |___ blockchain.yml #environments configuration
    |___ server.yml     #server configuration
```    

Solidity files in the contracts directory will automatically be deployed with embark run. Changes in any files will automatically be reflected in app, changes to contracts will result in a redeployment and update of their JS Bindings

Using Contracts
======
Embark will automatically take care of deployment for you and set all needed JS bindings. For example, the contract below:

```Javascript
# app/contracts/simple_storage.sol
contract SimpleStorage {
  uint storedData;
  function set(uint x) {
    storedData = x;
  }
  function get() constant returns (uint retVal) {
    return storedData;
  }
}
```
Will automatically be available in Javascript as:

```Javascript
# app/js/index.js
SimpleStorage.set(100);
SimpleStorage.get();
```

Working with different chains
======
You can specify which environment to deploy to

$ embark blockchain staging
$ embark run staging
the environment is a specific blockchain configuration that can be managed at config/blockchain.yml

```Yaml
# config/blockchain.yml
  ...
  staging:
    rpc_host: localhost
    rpc_port: 8101
    rpc_whitelist: "*"
    datadir: default
    network_id: 0
    console: true
    account:
      init: false
      address: 0x123
```

Deploying only contracts
======
Although embark run will automatically deploy contracts, you can choose to only deploy the contracts to a specific environment

```Bash
$ embark deploy privatenet
```

embark deploy will deploy all contracts at app/contracts and return the resulting addresses

LiveReload Plugin
======

Embark works quite well with the LiveReload Plugin
