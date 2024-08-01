const Crowdfunding = artifacts.require("Crowdfunding");

contract("Crowdfunding", (accounts) => {
    let crowdfunding;
    const beneficiary = accounts[0];

    const ONE_ETH = web3.utils.toWei("1", "ether");
    const ONGOING_STATE = "0";
    const FAILED_STATE = "1";
    const SUCCEEDED_STATE = "2";
    const PAID_OUT_STATE = "3";

    beforeEach(async () => {
        crowdfunding = await Crowdfunding.new('Campaign name', 1, 10, beneficiary, {from: beneficiary, gas: 2000000});
    });

    it("contract is initialized", async () => {
        const campaignName = await crowdfunding.name.call();
        expect(campaignName).to.equal("Campaign name");

        const targetAmount = await crowdfunding.targetAmount.call();
        expect(targetAmount.toString()).to.equal(ONE_ETH.toString());

        // const fundingDeadline = await crowdfunding.fundingDeadline.call();
        // expect(fundingDeadline.toNumber()).to.equal(1705800289);

        const actualBeneficiary = await crowdfunding.beneficiary.call();
        expect(actualBeneficiary).to.equal(beneficiary);

        const state = await crowdfunding.state.call();
        expect(state.valueOf().toString()).to.equal(ONGOING_STATE.toString());
    });

    it("Accepts ETH contributions", async () => {
        await crowdfunding.sendTransaction({value: ONE_ETH, from: accounts[1]})

        const contributed = await crowdfunding.amounts(accounts[1])
        expect(contributed.toString()).to.equal(ONE_ETH.toString())
    
        const totalCollected = await crowdfunding.totalCollected()
        expect(totalCollected.toString()).to.equal(ONE_ETH.toString())
    });

    async function increaseTime(increaseBySec) {
        return new Promise((resolve, reject) => {
            web3.currentProvider.send({
                jsonrpc: "2.0",
                method: "evm_increaseTime",
                params: [increaseBySec],
                id: new Date().getTime()
            }, (err, result) => {
                if (err) { return reject(err) }
                return resolve(result)
            });
        });
    }

    async function mineBlock() {
        return new Promise((resolve, reject) => {
            web3.currentProvider.send({
                jsonrpc: "2.0",
                method: "evm_mine",
                id: new Date().getTime()
            }, (err, result) => {
                if (err) { return reject(err) }
                return resolve(result)
            });
        });
    }

    it("does not allow contributions after deadline", async () => {
        try {
            await increaseTime(601);
            await mineBlock();
            await crowdfunding.sendTransaction({value: ONE_ETH, from: accounts[1]});
            expect.fail();
        } catch (error) {
            expect(error.message).to.equal("VM Exception while processing transaction: revert Cannot contribute after a deadline -- Reason given: Cannot contribute after a deadline.");
        }
    });

    it("sets state to FAILED if goal is not reached before deadline", async () => {
        await increaseTime(601);
        await mineBlock();
        await crowdfunding.finishCrowdfunding();
        const state = await crowdfunding.state.call();
        expect(state.valueOf().toString()).to.equal(FAILED_STATE);
    });

    it("sets state to SUCCEEDED if goal is not reached before deadline", async () => {
        await crowdfunding.sendTransaction({value: ONE_ETH, from: accounts[1]});
        await increaseTime(601);
        await mineBlock();
        await crowdfunding.finishCrowdfunding();
        const state = await crowdfunding.state.call();
        expect(state.valueOf().toString()).to.equal(SUCCEEDED_STATE);
    });

    it ("allows to collect money from the SUCCEEDED campaign", async () => {
        await crowdfunding.sendTransaction({value: ONE_ETH, from: accounts[1]});
        await increaseTime(601);
        await mineBlock();
        await crowdfunding.finishCrowdfunding();

        const initAmount = await web3.eth.getBalance(beneficiary);
        await crowdfunding.collect({from: beneficiary});

        const newBalance = await web3.eth.getBalance(beneficiary);
        expect((newBalance - initAmount).toString()).to.equal(ONE_ETH);

        // const amount = await crowdfunding.amounts(accounts[1]);
        // expect(amount.toNumber()).to.equal(0);

        const fundingState = await crowdfunding.state();
        expect(fundingState.toString()).to.equal(PAID_OUT_STATE);
    });

    it("allows to withdraw money from the FAILED campaign", async () => {
        await crowdfunding.sendTransaction({value: ONE_ETH - 100, from: accounts[1]});
        await increaseTime(601);
        await mineBlock();
        await crowdfunding.finishCrowdfunding();

        const fundingState = await crowdfunding.state();
        expect(fundingState.toString()).to.equal(FAILED_STATE);

        // const initAmount = await web3.eth.getBalance(beneficiary);
        // await crowdfunding.withdraw({from: beneficiary});

        // const newBalance = await web3.eth.getBalance(beneficiary);
        // expect(newBalance - initAmount).to.equal(0);

        const amount = await crowdfunding.amounts(accounts[1]);
        expect(amount.toString()).to.equal('999999999999999900');

        // const amount = await crowdfunding.amounts(accounts[1]);
        // expect(amount.toNumber()).to.equal(0);

    });

    it("emits an event when the campaign is finished", async () => {
        await increaseTime(601);
        await mineBlock();
        const tx = await crowdfunding.finishCrowdfunding();
        expect(tx.logs).to.have.lengthOf(1);

        const campaignFinishedEvent = tx.logs[0];
        expect(campaignFinishedEvent.event).to.equal("CampaignFinished");
        expect(campaignFinishedEvent.args.succeeded).to.equal(false);
        const eventArgs = campaignFinishedEvent.args;

        expect(eventArgs.succeeded).to.equal(false);
        // expect(eventArgs.address).to.equal(crowdfunding.address);
        expect(eventArgs.totalCollected.toString()).to.equal("0");        
    });

    it("allows owner to cancel the campaign ", async () => {
        await crowdfunding.sendTransaction({value: ONE_ETH, from: accounts[1]});
        await crowdfunding.cancel({from: beneficiary});

        const amount = await crowdfunding.amounts(accounts[1]);
        expect(amount.toString()).to.equal(ONE_ETH);

        const fundingState = await crowdfunding.state();
        expect(fundingState.toString()).to.equal(FAILED_STATE);

        // const initAmount = await web3.eth.getBalance(beneficiary);
        // await crowdfunding.withdraw({from: beneficiary});

        // const newBalance = await web3.eth.getBalance(beneficiary);
        // expect(newBalance - initAmount).to.equal(ONE_ETH);
    });

    it("does not allow non-owner to cancel the campaign", async () => {
        try {
            await crowdfunding.cancel({from: accounts[3]});
            expect.fail();
        } catch (error) {
            expect(error.message).to.include("Only the owner can cancel the campaign.");
        }
    });
});