require("dotenv").config();
const {ethers} = require('hardhat');
const {use, expect} = require('chai');
const {solidity} = require('ethereum-waffle');
use(solidity);

describe('Test token vendor contract', () => {

    let owner;
    let addr1;
    let addr2;
    let addr3;
    let ownTokenContract;
    let daiTokenContract;
    let vendorContract;
    let vendorTokensSupply;
    let ownableTokenName;
    const priceFeed = process.env.PRICE_FEED;
    const studentsContract = process.env.STUDENTS_CONTRACT;
    const daiTokenAddress = process.env.DAI_TOKEN_CONTRACT;

    before(async () => {
        [owner, addr1, addr2, addr3] = await ethers.getSigners();
        //Deploy ERC20 token
        let contractFactory = await ethers.getContractFactory('AlexGCoin');
        ownTokenContract = await contractFactory.deploy();
        //Deploy ERC721 token
        contractFactory = await ethers.getContractFactory('NFTFactory');
        const nftContract = await contractFactory.deploy('TestNFT', 'TFT');
        await nftContract.connect(owner).createToken(addr1.address);
        await nftContract.connect(owner).createToken(addr2.address);
        ownableTokenName = await nftContract.name();
        //Deploy vendor for ERC20 token
        contractFactory = await ethers.getContractFactory('TokenVendor', owner);
        vendorContract = await contractFactory.deploy();
        //Deploy VendorProxy
        contractFactory = await ethers.getContractFactory('VendorProxy', owner);
        let vendorProxyContract = await contractFactory.deploy();
        await vendorProxyContract.setImplementation(vendorContract.address);
        //Get proxy contract instance using TokenVendor interface
        vendorContract = await ethers.getContractAt('TokenVendor', vendorProxyContract.address, owner);
        await vendorContract.initialize(ownTokenContract.address, priceFeed, studentsContract, nftContract.address);
        await ownTokenContract.transfer(vendorContract.address, ownTokenContract.totalSupply());
        vendorTokensSupply = await ownTokenContract.balanceOf(vendorContract.address);
        //mint 1000 DAI tokens
        let mintableERC20Interface = 'AlexGCoin';
        daiTokenContract = await ethers.getContractAt(mintableERC20Interface, daiTokenAddress, owner);
        await daiTokenContract.connect(owner).mint(addr2.address, ethers.utils.parseEther("1000"));
    });

    describe('Test buyTokens() method', () => {

        it('buyTokens reverted: no eth sent', async () => {
            await expect(
                vendorContract.connect(addr1).buyTokens({value: 0})
            ).to.be.revertedWith('Send ETH to buy some tokens');
        });

        it('buyTokens reverted: dont have required NFT', async () => {
            await expect(
                vendorContract.connect(addr3).buyTokens({value: 0})
            ).to.be.revertedWith('Only owner of ' + ownableTokenName + ' can call this function');
        });

        it('buyTokens success!', async () => {
            const tokensPerEth = await vendorContract.tokenPrice();
            const sendAmount = ethers.utils.parseEther("2");
            const receiveAmount = tokensPerEth * 2;
            await expect(vendorContract.connect(addr1).buyTokens({value: sendAmount}))
                .to.emit(vendorContract, 'BuyTokens')
                .withArgs(addr1.address, sendAmount, receiveAmount);
            const userTokenBalance = await ownTokenContract.balanceOf(addr1.address);
            expect(userTokenBalance).to.equal(receiveAmount);
            const vendorTokenBalance = await ownTokenContract.balanceOf(vendorContract.address);
            expect(vendorTokenBalance).to.equal(vendorTokensSupply.sub(receiveAmount));
        });

        it('eth returned because vendor has not enough tokens', async () => {
            const tokensPerEth = await vendorContract.tokenPrice();
            const sendAmount = ethers.utils.parseEther('999');
            const receiveAmount = tokensPerEth * 999;
            const senderBalanceBefore = await ethers.provider.getBalance(addr1.address);
            const txResponse = await vendorContract.connect(addr1).buyTokens({value: sendAmount});
            const receipt = await txResponse.wait();
            const senderBalanceAfter = await ethers.provider.getBalance(addr1.address);
            await expect(txResponse)
                .to.emit(vendorContract, 'NotEnoughTokens')
                .withArgs(addr1.address, sendAmount, receiveAmount);
            let totalGasUsed = receipt.gasUsed.mul(txResponse.gasPrice);
            expect(senderBalanceBefore).to.equal(senderBalanceAfter.add(totalGasUsed));
        });
    });

    describe('Test setImplementation(implAddress) method', () => {

        it('setImplementation reverted: caller is not the owner', async () => {
            let vendorProxyContract = await ethers.getContractAt('VendorProxy', vendorContract.address, addr3);
            await expect(vendorProxyContract.connect(addr3).setImplementation(daiTokenContract.address))
                .to.be.revertedWith('Ownable: caller is not the owner');
        });

        it('setImplementation success', async () => {
            let contractFactory = await ethers.getContractFactory('TokenVendor', owner);
            let newVendorInstance = await contractFactory.deploy();
            let vendorProxyContract = await ethers.getContractAt('VendorProxy', vendorContract.address, owner);
            await vendorProxyContract.setImplementation(newVendorInstance.address);
        });
    });

    describe('Test buyTokensForERC20(payableTokenAddress, payableTokenAmount) method', () => {

        it('buyTokensForERC20 reverted no tokens sent', async () => {
            await expect(vendorContract.connect(addr2).buyTokensForERC20(daiTokenAddress, 0))
                .to.be.revertedWith('payableTokenAmount must be greater than zero');

            await expect(vendorContract.connect(addr2).buyTokensForERC20(daiTokenAddress, ethers.utils.parseEther("1")))
                .to.be.revertedWith('Allowance must be greater or equals to payableTokenAmount');

            const sendAmount = ethers.utils.parseEther('999');
            await daiTokenContract.connect(addr2).approve(vendorContract.address, sendAmount);
            const senderBalanceBefore = await daiTokenContract.balanceOf(addr2.address);
            await expect(vendorContract.connect(addr2).buyTokensForERC20(daiTokenAddress, sendAmount))
                .to.be.revertedWith('Not enough tokens for sell');
            const senderBalanceAfter = await daiTokenContract.balanceOf(addr2.address);
            expect(senderBalanceBefore).to.equal(senderBalanceAfter);
        });

        it('buyTokensForERC20 success!', async () => {
            await ownTokenContract.mint(vendorContract.address, ethers.utils.parseEther("10"));
            const tokensPerToken = await vendorContract.tokenPriceForERC20(daiTokenAddress);
            const sendAmount = ethers.utils.parseEther("2");
            const receiveAmount = tokensPerToken * 2;

            await expect(vendorContract.connect(addr2).buyTokensForERC20(daiTokenAddress, sendAmount))
                .to.emit(vendorContract, 'BuyTokens')
                .withArgs(addr2.address, sendAmount.toString(), receiveAmount.toString());

            const buyerTokenBalance = await ownTokenContract.balanceOf(addr2.address);
            expect(buyerTokenBalance.toString()).to.equal(receiveAmount.toString());

            const vendorDaiBalance = await daiTokenContract.balanceOf(vendorContract.address);
            expect(vendorDaiBalance.toString()).to.equal(sendAmount.toString());
        });

        it('buyTokensForERC20 reverted: dont have required NFT', async () => {
            await expect(
                vendorContract.connect(addr3).buyTokensForERC20(daiTokenAddress, 1234)
            ).to.be.revertedWith('Only owner of ' + ownableTokenName + ' can call this function');
        });
    });
});