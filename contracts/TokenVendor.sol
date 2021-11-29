// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./AlexGCoin.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

interface Students {
    function getStudentsList() external view returns (string[] memory);
}

contract TokenVendor is Ownable {

    AlexGCoin internal token;
    AggregatorV3Interface internal priceFeed;
    Students internal students;

    event BuyTokens(address buyer, uint256 amountOfETH, uint256 amountOfTokens);

    constructor(address tokenAddress, address priceFeedAddress, address studentsAddress) {
        token = AlexGCoin(tokenAddress);
        priceFeed = AggregatorV3Interface(priceFeedAddress);
        students = Students(studentsAddress);
    }

    function buyTokens() public payable returns (uint256 tokenAmount) {
        require(msg.value > 0, "Send ETH to buy some tokens");
        uint256 currentPrice = tokenPrice();
        uint256 amountToBuy = msg.value * currentPrice / (10 ** 18);
        uint256 vendorBalance = token.balanceOf(address(this));
        if (vendorBalance >= amountToBuy) {
            (bool sent) = token.transfer(msg.sender, amountToBuy);
            require(sent, "Failed to transfer token to user");
            emit BuyTokens(msg.sender, msg.value, amountToBuy);
            return amountToBuy;
        } else {
            (bool sent,) = msg.sender.call{value : msg.value}("Sorry, there is not enough tokens to buy");
            require(sent, "Failed to return back ETH to user");
            return 0;
        }
    }

    function tokenPrice() public view returns (uint256) {
        (,int256 ethUsdPrice,,,) = priceFeed.latestRoundData();
        return uint256(ethUsdPrice) / students.getStudentsList().length;
    }
}