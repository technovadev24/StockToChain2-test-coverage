const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("StockToChain2", (m) => {
    // Get deployment parameters from environment variables
    const companyWallet = process.env.COMPANY_WALLET;
    const platformWallet = process.env.PLATFORM_WALLET;

    // Deploy EUR/USD mock
    const eurUsdPriceFeed = m.contract("MockV3Aggregator", [8, 100000000], { id: "EurUsdPriceFeed" }); // 8 decimals, 1.00 USD

    // Deploy POL/USD mock
    const polUsdPriceFeed = m.contract("MockV3Aggregator", [8, 100000000], { id: "PolUsdPriceFeed" }); // 8 decimals, 1.00 USD

    // Deploy the main contract using the mock addresses
    const stockToChain2 = m.contract("StockToChain2", [
        eurUsdPriceFeed,
        polUsdPriceFeed,
        companyWallet,
        platformWallet
    ], { id: "StockToChain2" });

    return {
        stockToChain2,
        eurUsdPriceFeed,
        polUsdPriceFeed
    };
}); 