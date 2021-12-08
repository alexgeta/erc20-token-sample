// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AlexGCoin is ERC20 {

    constructor() ERC20("AlexGCoin", "AGC") {
        _mint(msg.sender, 10 ** 13);
    }

    function mint(address beneficiary, uint256 mintAmount) external {
        _mint(beneficiary, mintAmount);
    }
}