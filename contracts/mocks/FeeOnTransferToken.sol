// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MockUSDC.sol";

contract FeeOnTransferToken is MockERC20Base {
    constructor() MockERC20Base("Fee Token", "FEE", 6) {}

    function _transfer(address from, address to, uint256 amount) internal override {
        require(to != address(0), "transfer to zero");
        require(balanceOf[from] >= amount, "ERC20: insufficient balance");
        uint256 fee = amount / 100;
        uint256 received = amount - fee;
        balanceOf[from] -= amount;
        balanceOf[to] += received;
        totalSupply -= fee;
        emit Transfer(from, to, received);
        emit Transfer(from, address(0), fee);
    }
}
