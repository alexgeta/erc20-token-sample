// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
require("dotenv").config();

async function main() {
    //deploy token contract
    let deployable = await hre.ethers.getContractFactory("AlexGCoin");
    const tokenContract = await deployable.deploy();
    await tokenContract.deployed();
    await new Promise(resolve => setTimeout(resolve, 60000));
    await hre.run("verify:verify", {
        address: tokenContract.address,
        contract: "contracts/AlexGCoin.sol:AlexGCoin"
    });
    //deploy vendor contract
    const tokenContractAddress = tokenContract.address;
    const priceFeed = process.env.PRICE_FEED;
    const studentsContract = process.env.STUDENTS_CONTRACT;
    const ownableTokenContract = process.env.OWNABLE_TOKEN_CONTRACT;
    deployable = await hre.ethers.getContractFactory("TokenVendor");
    const vendorContract = await deployable.deploy(tokenContractAddress, priceFeed, studentsContract, ownableTokenContract);
    await vendorContract.deployed();
    await new Promise(resolve => setTimeout(resolve, 60000));
    await hre.run("verify:verify", {
        address: vendorContract.address,
        constructorArguments: [tokenContractAddress, priceFeed, studentsContract, ownableTokenContract]
    });
    await tokenContract.transfer(vendorContract.address, tokenContract.totalSupply());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
