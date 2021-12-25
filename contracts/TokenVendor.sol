// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./AlexGCoin.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "./VRFConsumerBaseUpgradeable.sol";

interface Students {
    function getStudentsList() external view returns (string[] memory);
}

contract TokenVendor is UUPSUpgradeable, OwnableUpgradeable, VRFConsumerBaseUpgradeable, ChainlinkClient {
    using Chainlink for Chainlink.Request;
    AlexGCoin internal ownToken;
    Students internal students;
    ERC721 internal ownableToken;

    event OrderCreated(address buyer, uint256 payableAmount, address payableERC20Address);
    event OrderCompleted(address buyer, uint256 payableAmount, uint256 sellAmount);
    event NotEnoughTokens(address buyer, uint256 payableAmount, uint256 sellAmount);

    struct OrderData {
        address buyer;
        uint payableAmount;
        address payableERC20Address;
        uint price;
        uint multiplier;
    }

    mapping(address => OrderData) private orderMap;
    mapping(bytes32 => address) private priceRequesterMap;
    mapping(bytes32 => address) private multiplierRequesterMap;
    //VRFConsumer properties
    bytes32 private keyHash;
    uint256 private fee;
    //ChainlinkClient properties
    address private oracle;
    bytes32 private jobId;

    function initialize(
        address tokenAddress,
        address studentsAddress,
        address ownableTokenAddress,
        address vrfCoordinator,
        address linkAddress,
        bytes32 _keyHash,
        uint256 _fee,
        address _oracle,
        bytes32 _jobId)
    public initializer
    {
        ownToken = AlexGCoin(tokenAddress);
        students = Students(studentsAddress);
        ownableToken = ERC721(ownableTokenAddress);
        keyHash = _keyHash;
        fee = _fee;
        oracle = _oracle;
        jobId = _jobId;
        setPublicChainlinkToken();
        __VRFConsumerBaseUpgradeable_init(vrfCoordinator, linkAddress);
        __UUPSUpgradeable_init();
        __Ownable_init();
    }

    function _authorizeUpgrade(address newImpl) internal override onlyOwner {
    }

    modifier onlyTokenOwner {
        uint256 tokenBalance = ownableToken.balanceOf(msg.sender);
        require(tokenBalance > 0, string(abi.encodePacked("Only owner of ", ownableToken.name(), " can call this function")));
        _;
    }

    function buyTokensForETH() public payable onlyTokenOwner {
        require(msg.value > 0, "Send ETH to buy some tokens");
        createNewOrder(msg.sender, msg.value, address(0));
    }

    function buyTokensForERC20(address payableTokenAddress, uint256 payableTokenAmount) public virtual onlyTokenOwner {
        require(payableTokenAmount > 0, "payableTokenAmount must be greater than zero");
        uint256 allowance = ERC20(payableTokenAddress).allowance(msg.sender, address(this));
        require(allowance >= payableTokenAmount, "Allowance must be greater or equals to payableTokenAmount");
        createNewOrder(msg.sender, payableTokenAmount, payableTokenAddress);
    }

    function createNewOrder(address buyer, uint payableAmount, address payableTokenAddress) internal {
        require(orderMap[buyer].buyer != buyer, "Order already in progress");
        priceRequesterMap[requestETHPrice()] = buyer;
        multiplierRequesterMap[requestRandomNumber()] = buyer;
        OrderData memory order;
        order.buyer = buyer;
        order.payableAmount = payableAmount;
        order.payableERC20Address = payableTokenAddress;
        orderMap[buyer] = order;
        emit OrderCreated(buyer, payableAmount, payableTokenAddress);
    }

    function completeOrder(OrderData memory orderData) internal {
        if (orderData.price == 0 || orderData.multiplier == 0) {
            return;
        }
        delete orderMap[orderData.buyer];
        uint256 currentPrice = calculateTokenPrice(orderData.price, orderData.multiplier);
        uint256 amountToBuy = orderData.payableAmount * currentPrice / (10 ** 18);
        uint256 vendorBalance = ownToken.balanceOf(address(this));
        if (vendorBalance >= amountToBuy) {
            if (orderData.payableERC20Address != address(0)) {
                bool paid = ERC20(orderData.payableERC20Address).transferFrom(orderData.buyer, address(this), orderData.payableAmount);
                require(paid, "Failed to transfer payable tokens from buyer to vendor wallet");
            }
            bool sent = ownToken.transfer(orderData.buyer, amountToBuy);
            require(sent, "Failed to transfer token to user");
            emit OrderCompleted(orderData.buyer, orderData.payableAmount, amountToBuy);
        } else {
            (bool sent,) = orderData.buyer.call{value : orderData.payableAmount}("Sorry, there is not enough tokens to buy");
            require(sent, "Failed to return back ETH to user");
            emit NotEnoughTokens(orderData.buyer, orderData.payableAmount, amountToBuy);
        }
    }

    function calculateTokenPrice(uint priceData, uint multiplier) internal view returns (uint256) {
        return ((priceData / students.getStudentsList().length) * multiplier) / 10 ** 18;
    }

    function requestRandomNumber() internal returns (bytes32) {
        require(LINK.balanceOf(address(this)) >= fee, "Not enough LINK to pay fee");
        return requestRandomness(keyHash, fee);
    }

    function requestETHPrice() internal returns (bytes32) {
        require(LINK.balanceOf(address(this)) >= fee, "Not enough LINK to pay fee");
        Chainlink.Request memory request = buildChainlinkRequest(jobId, address(this), this.fulfillETHPrice.selector);
        request.add("get", "https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD");
        request.add("path", "USD");
        request.addInt("times", 10 ** 18);
        return sendChainlinkRequestTo(oracle, request, fee);
    }

    function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
        address requester = multiplierRequesterMap[requestId];
        delete multiplierRequesterMap[requestId];
        orderMap[requester].multiplier = calculateMultiplier(randomness);
        completeOrder(orderMap[requester]);
    }

    function calculateMultiplier(uint256 randomness) internal pure returns (uint256) {
        uint256 min = 5 * 10 ** 17;//from 0.5
        uint256 max = 3 * 10 ** 18;//to 3
        return randomness % (max - min + 1) + min;
    }

    function fulfillETHPrice(bytes32 requestId, uint256 price) public recordChainlinkFulfillment(requestId) {
        address requester = priceRequesterMap[requestId];
        delete priceRequesterMap[requestId];
        orderMap[requester].price = price;
        completeOrder(orderMap[requester]);
    }
}