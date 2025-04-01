const hre = require("hardhat");

async function main() {
  // Deploy MockV3Aggregator for EUR/USD
  const MockV3Aggregator = await hre.ethers.getContractFactory("MockV3Aggregator");
  const eurUsdPriceFeed = await MockV3Aggregator.deploy(8, 100000000); // 8 decimals, 1.00 USD
  await eurUsdPriceFeed.waitForDeployment();
  console.log("EUR/USD Price Feed deployed to:", await eurUsdPriceFeed.getAddress());

  // Deploy MockV3Aggregator for POL/USD
  const polUsdPriceFeed = await MockV3Aggregator.deploy(8, 100000000); // 8 decimals, 1.00 USD
  await polUsdPriceFeed.waitForDeployment();
  console.log("POL/USD Price Feed deployed to:", await polUsdPriceFeed.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 