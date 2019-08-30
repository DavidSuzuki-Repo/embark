/*global contract, config, it*/
const assert = require('assert');
const SimpleStorage = require('Embark/contracts/SimpleStorage');

config({
  contracts: {
    deploy: {
      "SimpleStorage": {
        args: [100]
      }
    }
  }
});

contract("SimpleStorage", function () {
  this.timeout(0);

  it("should set constructor value", async function () {
    let result = await SimpleStorage.methods.storedData().call();
    assert.strictEqual(parseInt(result, 10), 100);
  });

  it("set storage value", async function () {
    await SimpleStorage.methods.set(150).send();
    let result = await SimpleStorage.methods.get().call();
    assert.strictEqual(parseInt(result, 10), 499650);
  });
});
