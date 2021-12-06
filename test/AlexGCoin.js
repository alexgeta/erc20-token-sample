const {expect} = require("chai");
const {ethers} = require("hardhat");

describe("Test token contract", function () {

    it("Deployment should assign the total supply of tokens to the owner", async function () {
        const [owner, spender] = await ethers.getSigners();
        const contractFactory = await ethers.getContractFactory('AlexGCoin');
        const tokenContract = await contractFactory.deploy();
        await tokenContract.deployed();
        const totalSupply = await tokenContract.totalSupply();
        const ownerBalance = await tokenContract.balanceOf(owner.address);
        expect(totalSupply.toString()).to.equal(ownerBalance.toString());
        let mintAmount = 10 ** 8;
        let tokensAmount = 123456789;
        let zeroAddress = '0x0000000000000000000000000000000000000000';
        await expect(tokenContract.connect(owner).mint(owner.address, mintAmount))
            .to.emit(tokenContract, 'Transfer').withArgs(zeroAddress, owner.address, mintAmount);

        await expect(tokenContract.connect(owner).approve(spender.address, tokensAmount))
            .to.emit(tokenContract, 'Approval').withArgs(owner.address, spender.address, tokensAmount);

        await expect(tokenContract.connect(owner).approve(owner.address, tokensAmount))
            .to.emit(tokenContract, 'Approval').withArgs(owner.address, owner.address, tokensAmount);

        await expect(tokenContract.connect(owner).transferFrom(owner.address, spender.address, tokensAmount))
            .to.emit(tokenContract, 'Transfer').withArgs(owner.address, spender.address, tokensAmount);

        const allowance = await tokenContract.allowance(owner.address, spender.address);
        expect(tokensAmount.toString()).to.equal(allowance.toString());
    });
});
