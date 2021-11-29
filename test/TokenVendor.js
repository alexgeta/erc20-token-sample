require("dotenv").config();
const {ethers} = require('hardhat');
const {use, expect} = require('chai');
const {solidity} = require('ethereum-waffle');
use(solidity);

describe('Test token vendor contract', () => {

    let owner;
    let addr1;
    let addr2;
    let tokenContract;
    let vendorContract;
    let vendorTokensSupply;
    const priceFeed = process.env.PRICE_FEED;
    const studentsContract = process.env.STUDENTS_CONTRACT;

    before(async () => {
        [owner, addr1, addr2] = await ethers.getSigners();
        let contractFactory = await ethers.getContractFactory('AlexGCoin');
        tokenContract = await contractFactory.deploy();
        contractFactory = await ethers.getContractFactory('TokenVendor');
        vendorContract = await contractFactory.deploy(tokenContract.address, priceFeed, studentsContract);
        await tokenContract.transfer(vendorContract.address, tokenContract.totalSupply());
        await vendorContract.transferOwnership(owner.address);
        vendorTokensSupply = await tokenContract.balanceOf(vendorContract.address);
    });

    describe('Test buyTokens() method', () => {

        it('buyTokens reverted no eth sent', async () => {
            const sendAmount = ethers.utils.parseEther("0");
            await expect(
                vendorContract.connect(addr1).buyTokens({
                    value: sendAmount,
                }),
            ).to.be.revertedWith('Send ETH to buy some tokens');
        });

        it('buyTokens success!', async () => {
            const tokensPerEth = await vendorContract.tokenPrice();
            const sendAmount = ethers.utils.parseEther("2");
            const receiveAmount = tokensPerEth * 2;
            await expect(
                vendorContract.connect(addr1).buyTokens({
                    value: sendAmount,
                }),
            ).to.emit(vendorContract, 'BuyTokens').withArgs(addr1.address, sendAmount, receiveAmount);
            const userTokenBalance = await tokenContract.balanceOf(addr1.address);
            expect(userTokenBalance).to.equal(receiveAmount);
            const vendorTokenBalance = await tokenContract.balanceOf(vendorContract.address);
            expect(vendorTokenBalance).to.equal(vendorTokensSupply.sub(receiveAmount));
        });

        it('eth returned because vendor has not enough tokens', async () => {
            const sendAmount = ethers.utils.parseEther('999');
            const txBuyTokens = await vendorContract.connect(addr2).buyTokens({value: sendAmount});
            await txBuyTokens.wait();
            await expect(txBuyTokens).to.changeEtherBalance(addr2, 0);
        });
    });
});