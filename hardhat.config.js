require("dotenv").config();

require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();
    for (const account of accounts) {
        console.log(account.address);
    }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
const {
    INFURA_KEY,
    ETHERSCAN_API_KEY,
    PRIVATE_KEY_TESTNET,
    PRIVATE_KEY,
    MNEMONIC
} = process.env;

const accountsTestnet = PRIVATE_KEY_TESTNET
    ? [PRIVATE_KEY_TESTNET]
    : {mnemonic: MNEMONIC};

const accountsMainnet = PRIVATE_KEY
    ? [PRIVATE_KEY]
    : {mnemonic: MNEMONIC};

module.exports = {
    solidity: "0.8.9",

    networks: {
        hardhat: {
            forking: {
                url: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
                accounts: accountsTestnet
            }
        },
        mainnet: {
            url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
            // accounts: accountsMainnet,
        },
        rinkeby: {
            url: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
            accounts: accountsTestnet,
        },
        ropsten: {
            url: `https://ropsten.infura.io/v3/${INFURA_KEY}`,
            accounts: accountsTestnet,
        }
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY,
    }
};