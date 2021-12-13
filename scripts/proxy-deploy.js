// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const {ethers} = require("hardhat");
require("dotenv").config();

async function main() {
    //Deploy token contract
    let deployable = await hre.ethers.getContractFactory("AlexGCoin");
    /*const tokenContract = await deployable.deploy();
    await tokenContract.deployed();
    await new Promise(resolve => setTimeout(resolve, 60000));
    await hre.run("verify:verify", {
        address: tokenContract.address,
        contract: "contracts/AlexGCoin.sol:AlexGCoin"
    });*/
    //Deploy Vendor contract
    deployable = await hre.ethers.getContractFactory("TokenVendor");
    let vendorContract = await deployable.deploy();
    await vendorContract.deployed();
    await new Promise(resolve => setTimeout(resolve, 60000));
    await hre.run("verify:verify", {
        address: vendorContract.address
    });
    const tokenContractAddress = '0x46B32Cf8b2BF580a118cD884dCF0A7Ae0f8A1604';
    const priceFeed = process.env.PRICE_FEED;
    const studentsContract = process.env.STUDENTS_CONTRACT;
    const ownableTokenContract = process.env.OWNABLE_TOKEN_CONTRACT;
    //Deploy VendorProxy
    deployable = await hre.ethers.getContractFactory('VendorProxy');
    let vendorProxyContract = await deployable.deploy();
    await vendorProxyContract.deployed();
    await vendorProxyContract.setImplementation(vendorContract.address);
    //Get proxy contract instance using TokenVendor interface
    vendorContract = await ethers.getContractAt('TokenVendor', vendorProxyContract.address);
    await vendorContract.initialize(tokenContractAddress, priceFeed, studentsContract, ownableTokenContract);
    // await tokenContract.transfer(vendorContract.address, tokenContract.totalSupply());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
