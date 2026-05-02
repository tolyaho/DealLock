// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

/**
 * @title DealLockMultiAssetV2Deployer
 * @notice Deployment helper for Factory V3. Receives V6 creation bytecode in
 *         chunks at construction time and stores each chunk as runtime code in
 *         a separate pointer contract. Keeping the V6 init code out of the
 *         deployer's own compiled bytecode keeps all deployed contracts under
 *         the EVM 24,576-byte limit.
 *
 *         The helper has no ownership, funds, registry, admin powers, or
 *         control over deployed agreements.
 */
contract DealLockBytecodeChunk {
    constructor(bytes memory data) {
        assembly {
            return(add(data, 0x20), mload(data))
        }
    }
}

contract DealLockMultiAssetV2Deployer {
    uint256 private constant MAX_CHUNK_SIZE = 24_000;

    address private immutable _creationCodePart1;
    address private immutable _creationCodePart2;
    uint256 private immutable _creationCodePart1Length;
    uint256 private immutable _creationCodePart2Length;

    constructor(bytes memory creationCodePart1, bytes memory creationCodePart2) {
        require(creationCodePart1.length > 0, "Empty creation code");
        require(creationCodePart1.length <= MAX_CHUNK_SIZE, "Chunk 1 too large");
        require(creationCodePart2.length <= MAX_CHUNK_SIZE, "Chunk 2 too large");

        _creationCodePart1 = address(new DealLockBytecodeChunk(creationCodePart1));
        _creationCodePart1Length = creationCodePart1.length;

        address part2 = address(0);
        uint256 part2Length = 0;
        if (creationCodePart2.length > 0) {
            part2 = address(new DealLockBytecodeChunk(creationCodePart2));
            part2Length = creationCodePart2.length;
        }
        _creationCodePart2 = part2;
        _creationCodePart2Length = part2Length;
    }

    function deploy(
        address client,
        address provider,
        address paymentToken,
        string[] calldata descriptions,
        uint256[] calldata amounts,
        uint256[] calldata deadlines,
        uint256 reviewPeriod
    ) external returns (address agreement) {
        bytes memory creationCode = _readCreationCode();
        bytes memory initCode = abi.encodePacked(
            creationCode,
            abi.encode(client, provider, paymentToken, descriptions, amounts, deadlines, reviewPeriod)
        );
        assembly {
            agreement := create(0, add(initCode, 0x20), mload(initCode))
        }
        require(agreement != address(0), "Deployment failed");
    }

    function _readCreationCode() private view returns (bytes memory creationCode) {
        uint256 part1Length = _creationCodePart1Length;
        uint256 part2Length = _creationCodePart2Length;
        creationCode = new bytes(part1Length + part2Length);

        address part1 = _creationCodePart1;
        assembly {
            extcodecopy(part1, add(creationCode, 0x20), 0, part1Length)
        }

        if (part2Length > 0) {
            address part2 = _creationCodePart2;
            assembly {
                extcodecopy(part2, add(add(creationCode, 0x20), part1Length), 0, part2Length)
            }
        }
    }
}
