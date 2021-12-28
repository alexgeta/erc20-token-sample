require("dotenv").config();
const {ethers} = require('hardhat');
const {use, expect} = require('chai');
const {solidity} = require('ethereum-waffle');
const {signMetaTxRequest} = require("../scripts/signer");
use(solidity);

async function deploy(name, ...params) {
    const Contract = await ethers.getContractFactory(name);
    return await Contract.deploy(...params).then(f => f.deployed());
}

describe('Test token vendor contract', () => {

    let accounts;
    let forwarder;
    let ownTokenContract;
    let daiTokenContract;
    let vendorContract;
    const ownableTokenName = 'TestNFT';
    const priceFeed = process.env.PRICE_FEED;
    const studentsContract = process.env.STUDENTS_CONTRACT;
    const daiTokenAddress = process.env.DAI_TOKEN_CONTRACT;

    before(async () => {
        accounts = await ethers.getSigners();
        forwarder = await deploy('MinimalForwarder');

        //Deploy ERC20 token
        ownTokenContract = await deploy('AlexGCoin');

        //Deploy ERC721 token
        const nftContract = await deploy('NFTFactory', ownableTokenName, 'TFT');
        await nftContract.connect(accounts[0]).createToken(accounts[1].address);
        await nftContract.connect(accounts[0]).createToken(accounts[2].address);

        //mint 1000 DAI tokens
        daiTokenContract = await ethers.getContractAt('ERC20Mintable', daiTokenAddress, accounts[0]);
        await daiTokenContract.connect(accounts[0]).mint(accounts[2].address, ethers.utils.parseEther("1000"));

        //Deploy vendor for ERC20 token
        vendorContract = await deploy('TokenVendor');
        let tokenVendorInterface = (await ethers.getContractFactory('TokenVendor')).interface;

        //Deploy VendorProxy
        const initFuncCallData = tokenVendorInterface.encodeFunctionData(
            "initialize",
            [ownTokenContract.address, priceFeed, studentsContract, nftContract.address, forwarder.address]);
        let vendorProxyContract = await deploy('VendorProxy', vendorContract.address, initFuncCallData);

        //Get proxy contract instance using TokenVendor interface
        vendorContract = await ethers.getContractAt('TokenVendor', vendorProxyContract.address, accounts[0]);
        await ownTokenContract.transfer(vendorContract.address, ownTokenContract.totalSupply());
        console.log(`MinimalForwarder deployed at ${forwarder.address}`);
        console.log(`TokenVendor deployed at ${vendorContract.address}`);
    });

    describe('Test buyTokensForERC20(payableTokenAddress, payableTokenAmount) method', () => {

        it('buyTokensForERC20 success!', async () => {
            await ownTokenContract.mint(vendorContract.address, ethers.utils.parseEther("10"));
            const tokensPerToken = await vendorContract.tokenPriceForERC20(daiTokenAddress);
            const sendAmount = ethers.utils.parseEther("2");
            const receiveAmount = tokensPerToken * 2;
            const signer = accounts[2];
            const relayer = accounts[3];
            await daiTokenContract.connect(signer).approve(vendorContract.address, sendAmount);

            let metaTx = await signMetaTxRequest(signer.provider, forwarder, {
                from: signer.address,
                to: vendorContract.address,
                data: vendorContract.interface.encodeFunctionData('buyTokensForERC20', [daiTokenAddress, sendAmount]),
            });
            let signerBalanceBefore = await ethers.provider.getBalance(signer.address);
            let tx = await forwarder.connect(relayer).execute(metaTx.request, metaTx.signature);
            await expect(tx)
                .to.emit(vendorContract, 'BuyTokens')
                .withArgs(signer.address, sendAmount.toString(), receiveAmount.toString());
            let signerBalanceAfter = await ethers.provider.getBalance(signer.address);
            expect(signerBalanceBefore.toString()).to.equal(signerBalanceAfter.toString());

            const buyerTokenBalance = await ownTokenContract.balanceOf(signer.address);
            expect(buyerTokenBalance.toString()).to.equal(receiveAmount.toString());

            const vendorDaiBalance = await daiTokenContract.balanceOf(vendorContract.address);
            expect(vendorDaiBalance.toString()).to.equal(sendAmount.toString());
        });
    });
});