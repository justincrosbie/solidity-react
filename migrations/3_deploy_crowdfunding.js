const Crowdfunding = artifacts.require("Crowdfunding");

module.exports = function(deployer) {
    deployer.deploy(
        Crowdfunding, 
        'Test Campaign doo-wop', 
        1, 
        5*24*60, 
        '0xe2833EF5a2324f4db53c50c0F52FF964966c69D0'
    )
}
