const {expect} = require("chai");
const {ethers} = require("hardhat");

describe("Test token contract", function () {

    it("Deployment should assign the total supply of tokens to the owner", async function () {
        const [owner] = await ethers.getSigners();
        const contractFactory = await ethers.getContractFactory('AlexGCoin');
        const tokenContract = await contractFactory.deploy();
        await tokenContract.deployed();
        const totalSupply = await tokenContract.totalSupply();
        const ownerBalance = await tokenContract.balanceOf(owner.address);
        expect(totalSupply.toString()).to.equal(ownerBalance.toString());
        let mintAmount = 10 ** 8;
        let zeroAddress = '0x0000000000000000000000000000000000000000';
        await expect(tokenContract.connect(owner).mint(owner.address, mintAmount))
            .to.emit(tokenContract, 'Transfer').withArgs(zeroAddress, owner.address, mintAmount);
    });
});
