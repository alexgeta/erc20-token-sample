// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./AlexGCoin.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/metatx/ERC2771ContextUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

interface Students {
    function getStudentsList() external view returns (string[] memory);
}

contract TokenVendor is ERC2771ContextUpgradeable, UUPSUpgradeable, OwnableUpgradeable {

    AlexGCoin internal ownToken;
    AggregatorV3Interface internal priceFeed;
    Students internal students;
    ERC721 internal ownableToken;

    event BuyTokens(address buyer, uint256 paidAmount, uint256 sellAmount);
    event NotEnoughTokens(address buyer, uint256 paidAmount, uint256 sellAmount);

    function initialize(
        address tokenAddress,
        address priceFeedAddress,
        address studentsAddress,
        address ownableTokenAddress,
        address trustedForwarder)
    public initializer {

        ownToken = AlexGCoin(tokenAddress);
        priceFeed = AggregatorV3Interface(priceFeedAddress);
        students = Students(studentsAddress);
        ownableToken = ERC721(ownableTokenAddress);
        __ERC2771Context_init(trustedForwarder);
        __UUPSUpgradeable_init();
        __Ownable_init();
    }

    function _authorizeUpgrade(address newImpl) internal override onlyOwner {
    }

    modifier onlyTokenOwner {
        uint256 tokenBalance = ownableToken.balanceOf(_msgSender());
        require(tokenBalance > 0, string(abi.encodePacked("Only owner of ", ownableToken.name(), " can call this function")));
        _;
    }

    function buyTokens() public payable onlyTokenOwner {
        require(msg.value > 0, "Send ETH to buy some tokens");
        uint256 currentPrice = tokenPrice();
        uint256 amountToBuy = msg.value * currentPrice / (10 ** 18);
        uint256 vendorBalance = ownToken.balanceOf(address(this));
        if (vendorBalance >= amountToBuy) {
            bool sent = ownToken.transfer(_msgSender(), amountToBuy);
            require(sent, "Failed to transfer token to user");
            emit BuyTokens(_msgSender(), msg.value, amountToBuy);
        } else {
            (bool sent,) = _msgSender().call{value : msg.value}("Sorry, there is not enough tokens to buy");
            require(sent, "Failed to return back ETH to user");
            emit NotEnoughTokens(_msgSender(), msg.value, amountToBuy);
        }
    }

    function buyTokensForERC20(address payableTokenAddress, uint256 payableTokenAmount) public virtual onlyTokenOwner {
        require(payableTokenAmount > 0, "payableTokenAmount must be greater than zero");
        uint256 allowance = ERC20(payableTokenAddress).allowance(_msgSender(), address(this));
        require(allowance >= payableTokenAmount, "Allowance must be greater or equals to payableTokenAmount");
        uint256 currentPrice = tokenPriceForERC20(payableTokenAddress);
        uint256 amountToBuy = payableTokenAmount * currentPrice / (10 ** 18);
        uint256 vendorBalance = ownToken.balanceOf(address(this));
        require(vendorBalance >= amountToBuy, "Not enough tokens for sell");
        bool paid = ERC20(payableTokenAddress).transferFrom(_msgSender(), address(this), payableTokenAmount);
        require(paid, "Failed to transfer payable tokens from buyer to vendor wallet");
        bool sent = ownToken.transfer(_msgSender(), amountToBuy);
        require(sent, "Failed to transfer tokens to buyer");
        emit BuyTokens(_msgSender(), payableTokenAmount, amountToBuy);
    }

    function tokenPrice() public view returns (uint256) {
        (,int256 ETHUSDPrice,,,) = priceFeed.latestRoundData();
        return uint256(ETHUSDPrice) / students.getStudentsList().length;
    }

    function tokenPriceForERC20(address payableTokenAddress) public pure returns (uint256) {
        return 1 * 10 ** 18;
    }

    function _msgSender() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (address sender) {
        return ERC2771ContextUpgradeable._msgSender();
    }

    function _msgData() internal view override(ContextUpgradeable, ERC2771ContextUpgradeable) returns (bytes calldata) {
        return ERC2771ContextUpgradeable._msgData();
    }
}