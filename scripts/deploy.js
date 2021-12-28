const hre = require("hardhat");
require("dotenv").config();

const tokenContractAddress = '0x46B32Cf8b2BF580a118cD884dCF0A7Ae0f8A1604';
const priceFeed = process.env.PRICE_FEED;
const studentsContract = process.env.STUDENTS_CONTRACT;
const ownableTokenContract = process.env.OWNABLE_TOKEN_CONTRACT;

async function deploy(name, ...params) {
    const Contract = await hre.ethers.getContractFactory(name);
    return await Contract.deploy(...params).then(f => f.deployed());
}

async function main() {
    let forwarder = await deploy('MinimalForwarder');
    console.log("MinimalForwarder deployed at " + forwarder.address);
    await new Promise(resolve => setTimeout(resolve, 60000));
    try {
        await hre.run("verify:verify", {address: forwarder.address});
    } catch (ignore) {
    }
    //Deploy TokenVendor
    let vendorContract = await deploy('TokenVendor');
    let vendorInterface = vendorContract.interface;
    await new Promise(resolve => setTimeout(resolve, 60000));
    try {
        await hre.run("verify:verify", {address: vendorContract.address});
    } catch (ignore) {
    }
    //Deploy VendorProxy
    const initFuncCallData = vendorInterface.encodeFunctionData(
        "initialize",
        [tokenContractAddress, priceFeed, studentsContract, ownableTokenContract, forwarder.address]);
    let vendorProxyContract = await deploy('VendorProxy', vendorContract.address, initFuncCallData);
    console.log("VendorProxy deployed at " + vendorProxyContract.address);
    await new Promise(resolve => setTimeout(resolve, 60000));
    try {
        await hre.run("verify:verify", {
            address: vendorProxyContract.address,
            contract: "contracts/VendorProxy.sol:VendorProxy",
            constructorArguments: [vendorContract.address, initFuncCallData]
        });
    } catch (ignore) {
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});