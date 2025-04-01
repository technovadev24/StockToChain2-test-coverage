const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("MockPriceFeeds", (m) => {
    // Deploy EUR/USD mock
    const eurUsdPriceFeed = m.contract("MockV3Aggregator", [8, 100000000]); // 8 decimals, 1.00 USD

    // Deploy POL/USD mock
    const polUsdPriceFeed = m.contract("MockV3Aggregator", [8, 100000000]); // 8 decimals, 1.00 USD

    return {
        eurUsdPriceFeed,
        polUsdPriceFeed
    };
}); 