let Utils = artifacts.require("./Utils.sol");
let Crowdfunding = artifacts.require("./Crowdfunding.sol");

module.exports = async function(deployer) {
    await deployer.deploy(Utils);
    deployer.link(Utils, Crowdfunding);
};