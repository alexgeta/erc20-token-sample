// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./ERC20Mintable.sol";

contract AlexGCoin is ERC20Mintable {

    constructor() ERC20Mintable("AlexGCoin", "AGC") {
        _mint(msg.sender, 10 ** 13);
    }
}