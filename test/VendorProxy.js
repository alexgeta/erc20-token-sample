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

    const tokenContractAddress = '0x46B32Cf8b2BF580a118cD884dCF0A7Ae0f8A1604';
    const studentsContract = process.env.STUDENTS_CONTRACT;
    const daiTokenAddress = process.env.DAI_TOKEN_CONTRACT;
    const vrfCoordinator = process.env.VRF_COORDINATOR_CONTRACT;
    const linkToken = process.env.LINK_TOKEN_CONTRACT;
    const vrfKeyHash = process.env.VRF_KEY_HASH;
    const vrfFee = process.env.VRF_FEE;
    const oracle = process.env.ORACLE;
    const jobId = process.env.JOB_ID;

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
        let tokenVendorInterface = contractFactory.interface;
        //Deploy VendorProxy
        const initFuncCallData = tokenVendorInterface.encodeFunctionData(
            "initialize",
            [tokenContractAddress,
                studentsContract,
                nftContract.address,
                vrfCoordinator,
                linkToken,
                vrfKeyHash,
                vrfFee,
                oracle,
                ethers.utils.toUtf8Bytes(jobId)
            ]);
        contractFactory = await ethers.getContractFactory('VendorProxy', owner);
        let vendorProxyContract = await contractFactory.deploy(vendorContract.address, initFuncCallData);
        //Get proxy contract instance using TokenVendor interface
        console.log("Vendor Proxy contract address = " + vendorProxyContract.address);
        vendorContract = await ethers.getContractAt('TokenVendor', vendorProxyContract.address, owner);
        let linkContract = await ethers.getContractAt('ERC20', linkToken, owner);
        console.log("Vendor Proxy contract LINK balance = " + await linkContract.balanceOf(vendorProxyContract.address));
        await ownTokenContract.transfer(vendorContract.address, ownTokenContract.totalSupply());
        vendorTokensSupply = await ownTokenContract.balanceOf(vendorContract.address);
        //mint 1000 DAI tokens
        let mintableERC20Interface = 'AlexGCoin';
        daiTokenContract = await ethers.getContractAt(mintableERC20Interface, daiTokenAddress, owner);
        await daiTokenContract.connect(owner).mint(addr2.address, ethers.utils.parseEther("1000"));
    });

    describe('Test buyTokensForETH() method', () => {

        it('test OrderCreated event', async () => {
            const sendAmount = ethers.utils.parseEther("2");
            await expect(vendorContract.connect(addr1).buyTokensForETH({value: sendAmount}))
                .to.emit(vendorContract, 'OrderCreated')
                .withArgs(addr1.address, sendAmount);
            let linkContract = await ethers.getContractAt('ERC20', linkToken, owner);
            console.log("Vendor Proxy contract LINK balance = " + await linkContract.balanceOf(vendorContract.address));
        });

        it('test Order already in progress', async () => {
            const sendAmount = ethers.utils.parseEther("3");
            await expect(vendorContract.connect(addr1).buyTokensForETH({value: sendAmount}))
                .to.be.revertedWith("Order already in progress");
        });
    });

    describe('Test upgradeTo(implAddress) method', () => {

        it('upgradeTo reverted: caller is not the owner', async () => {
            await expect(vendorContract.connect(addr2).upgradeTo(daiTokenContract.address))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it('upgradeTo success', async () => {
            let contractFactory = await ethers.getContractFactory('TokenVendor', owner);
            let newVendorInstance = await contractFactory.deploy();
            let upgradeResult = await vendorContract.connect(owner).upgradeTo(newVendorInstance.address);
            expect(upgradeResult)
                .to.emit(vendorContract, 'Upgraded')
                .withArgs(newVendorInstance.address);
        });
    });

    describe('Test buyTokensForERC20(payableTokenAddress, payableTokenAmount) method', () => {

        it('test OrderCreated event', async () => {
            const sendAmount = ethers.utils.parseEther('3');
            await daiTokenContract.connect(addr2).approve(vendorContract.address, sendAmount);
            await expect(vendorContract.connect(addr2).buyTokensForERC20(daiTokenAddress, sendAmount))
                .to.emit(vendorContract, 'OrderCreated')
                .withArgs(addr2.address, sendAmount);
        });

    });
});