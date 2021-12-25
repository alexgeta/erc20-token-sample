// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";
import "@chainlink/contracts/src/v0.8/VRFRequestIDBase.sol";

abstract contract VRFConsumerBaseUpgradeable is VRFRequestIDBase, Initializable {

    uint256 constant private USER_SEED_PLACEHOLDER = 0;
    LinkTokenInterface internal LINK;
    address private vrfCoordinator;
    mapping(bytes32 /* keyHash */ => uint256 /* nonce */) private nonces;

    function __VRFConsumerBaseUpgradeable_init(address _vrfCoordinator, address _linkAddress) internal initializer {
        vrfCoordinator = _vrfCoordinator;
        LINK = LinkTokenInterface(_linkAddress);
    }

    function requestRandomness(bytes32 _keyHash, uint256 _fee) internal returns (bytes32 requestId) {
        LINK.transferAndCall(vrfCoordinator, _fee, abi.encode(_keyHash, USER_SEED_PLACEHOLDER));
        uint256 vRFSeed = makeVRFInputSeed(_keyHash, USER_SEED_PLACEHOLDER, address(this), nonces[_keyHash]);
        nonces[_keyHash] = nonces[_keyHash] + 1;
        return makeRequestId(_keyHash, vRFSeed);
    }

    function rawFulfillRandomness(bytes32 requestId, uint256 randomness) external {
        require(msg.sender == vrfCoordinator, "Only VRFCoordinator can fulfill");
        fulfillRandomness(requestId, randomness);
    }

    function fulfillRandomness(bytes32 requestId, uint256 randomness) internal virtual;

}