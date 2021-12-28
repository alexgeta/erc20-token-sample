const {ethers} = require('hardhat');
const {signMetaTxRequest} = require("../scripts/signer");
require("dotenv").config();

const { DefenderRelaySigner, DefenderRelayProvider } = require('defender-relay-client/lib/ethers');
const credentials = { apiKey: process.env.RELAYER_API_KEY, apiSecret: process.env.RELAYER_API_SECRET };
const provider = new DefenderRelayProvider(credentials);
const relayer = new DefenderRelaySigner(credentials, provider, { speed: 'fast' });

const forwarderAddress = '0x017C3bFc014278a1841cfE4a04F6adaD259C2446';
const tokenVendorAddress = '0xbF6E3E46A4ca489f8F0d0a4043533F95d2F3E832';
const linkTokenAddress = '0x01BE23585060835E02B77ef475b0Cc51aA1e0709';

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("Using signer " + signer.address);
    console.log("Using relayer " + (await relayer.getAddress()));
    const forwarder = await ethers.getContractAt('MinimalForwarder', forwarderAddress);
    const vendorContract = await ethers.getContractAt('TokenVendor', tokenVendorAddress);
    const linkTokenContract = await ethers.getContractAt('ERC20', linkTokenAddress);
    let sendAmount = ethers.utils.parseEther("2");
    await linkTokenContract.connect(signer).approve(vendorContract.address, sendAmount);

    let metaTx = await signMetaTxRequest(signer.provider, forwarder, {
        from: signer.address,
        to: vendorContract.address,
        data: vendorContract.interface.encodeFunctionData('buyTokensForERC20', [linkTokenContract.address, sendAmount]),
    });
    let tx = await forwarder.connect(relayer).execute(metaTx.request, metaTx.signature);
    JSON.stringify(tx, null, 4)
    let receipt = await tx.wait();
    JSON.stringify(receipt, null, 4)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});