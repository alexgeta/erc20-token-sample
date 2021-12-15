// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
require("dotenv").config();

const tokenContractAddress = '0x46B32Cf8b2BF580a118cD884dCF0A7Ae0f8A1604';
const priceFeed = process.env.PRICE_FEED;
const studentsContract = process.env.STUDENTS_CONTRACT;
const ownableTokenContract = process.env.OWNABLE_TOKEN_CONTRACT;

async function main() {
    //Deploy TokenVendor
    let deployable = await hre.ethers.getContractFactory("TokenVendor");
    let vendorInterface = deployable.interface;
    let vendorContract = await deployable.deploy();
    await vendorContract.deployed();
    await new Promise(resolve => setTimeout(resolve, 60000));
    await hre.run("verify:verify", {address: vendorContract.address});

    //Deploy VendorProxy
    const initFuncCallData = vendorInterface.encodeFunctionData(
        "initialize",
        [tokenContractAddress, priceFeed, studentsContract, ownableTokenContract]);
    deployable = await hre.ethers.getContractFactory('VendorProxy');
    let vendorProxyContract = await deployable.deploy(vendorContract.address, initFuncCallData);
    await vendorProxyContract.deployed();
    console.log("VendorProxy deployed at " + vendorProxyContract.address);
    await new Promise(resolve => setTimeout(resolve, 60000));
    await hre.run("verify:verify", {
        address: vendorProxyContract.address,
        contract: "contracts/VendorProxy.sol:VendorProxy",
        constructorArguments: [vendorContract.address, initFuncCallData]
    });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});