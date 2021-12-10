const {expect} = require("chai");
const {ethers} = require("hardhat");

describe("Minting the token and returning it", function () {

    it("should the contract be able to mint a function and return it", async function () {
        const [owner] = await ethers.getSigners();
        const contractFactory = await ethers.getContractFactory("NFTFactory");
        const nftContract = await contractFactory.deploy("testnft", "tft");
        const transaction = await nftContract.createToken(owner.address);
        await transaction.wait();
        const tokenAmount = await nftContract.balanceOf(owner.address);
        expect(tokenAmount).to.be.equal(1);
    });
});