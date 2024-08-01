// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Utils.sol";

contract Crowdfunding is Ownable {

    using Utils for uint;

    enum State { Ongoing, Failed, Succeeded, PaidOut }

    event CampaignFinished(
        address addr,
        uint totalCollected,
        bool succeeded
    );

    string public name;
    uint public targetAmount;
    uint public fundingDeadline;
    address payable public beneficiary;
    State public state;
    mapping(address => uint) public amounts;
    bool public collected;

    modifier inState(State expectedState) {
        require(state == expectedState, "Invalid state");
        _;
    }

    constructor(
        string memory campaignName,
        uint targetAmountEth,
        uint durationInMin,
        address payable beneficiaryAddress
    ) {
        name = campaignName;
        targetAmount = targetAmountEth.etherToWei();
        fundingDeadline = currentTime() + durationInMin.minutesToSeconds();
        beneficiary = beneficiaryAddress;
        state = State.Ongoing;

        transferOwnership(beneficiary);
    }

    receive() external payable inState(State.Ongoing) {
        require(beforeDeadline(), "Cannot contribute after a deadline");

        amounts[msg.sender] += msg.value;

        if (totalCollected() >= targetAmount) {
            collected = true;
        }
    }

    function finishCrowdfunding() public inState(State.Ongoing) {
        require(afterDeadline(), "Cannot finish campaign before a deadline");

        if (!collected) {
            state = State.Failed;
        } else {
            state = State.Succeeded;
        }

        emit CampaignFinished(address(this), totalCollected(), collected);
    }

    function cancel() public onlyOwner inState(State.Ongoing) {
        require(beforeDeadline(), "Cannot cancel campaign after a deadline");

        state = State.Failed;
        // emit CampaignFinished(address(this), totalCollected(), false);
    }

    function collect() public inState(State.Succeeded) {
        if (beneficiary.send(totalCollected())) {
            state = State.PaidOut;
        } else {
            state = State.Failed;
        }
    }

    function withdraw() public inState(State.Failed) {
        require(amounts[msg.sender] > 0, "Nothing was contributed");

        uint contributed = amounts[msg.sender];
        amounts[msg.sender] = 0;

        if (!payable(msg.sender).send(contributed)) {
            amounts[msg.sender] = contributed;
        }
    }

    function totalCollected() public view returns (uint) {
        return address(this).balance;
    }

    function currentTime() private view returns (uint) {
        return block.timestamp;
    }

    function beforeDeadline() private view returns (bool) {
        return currentTime() < fundingDeadline;
    }

    function afterDeadline() private view returns (bool) {
        return !beforeDeadline();
    }
}

