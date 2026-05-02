// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @notice Malicious ETH receiver for reentrancy tests.
 *         On receive, attempts to call an arbitrary target with stored calldata.
 *         The inner call failure is silently absorbed so the outer ETH transfer
 *         still succeeds — this lets tests verify the reentrancy guard is the
 *         only thing stopping the attack.
 */
contract MaliciousETHReceiver {
    address public target;
    bytes public attackCalldata;
    bool public attackEnabled;
    bool public innerCallReverted;
    bytes public innerRevertData;

    function setAttack(address target_, bytes calldata calldata_, bool enabled) external {
        target = target_;
        attackCalldata = calldata_;
        attackEnabled = enabled;
        innerCallReverted = false;
        innerRevertData = "";
    }

    receive() external payable {
        if (attackEnabled) {
            attackEnabled = false;
            (bool ok, bytes memory data) = target.call(attackCalldata);
            if (!ok) {
                innerCallReverted = true;
                innerRevertData = data;
            }
        }
    }
}
