// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MockUSDC.sol";

interface IReentrantTarget {
    function approveMilestone(uint256 milestoneId) external;
}

contract ReentrantERC20 is MockERC20Base {
    address public target;
    bool public attackEnabled;

    constructor() MockERC20Base("Reentrant Token", "REENT", 6) {}

    function setAttack(address target_, bool enabled) external {
        target = target_;
        attackEnabled = enabled;
    }

    function _transfer(address from, address to, uint256 amount) internal override {
        super._transfer(from, to, amount);
        if (attackEnabled && target != address(0) && from == target) {
            attackEnabled = false;
            IReentrantTarget(target).approveMilestone(0);
        }
    }
}
