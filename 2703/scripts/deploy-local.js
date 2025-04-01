const hre = require("hardhat");

async function main() {
  // Get the contract factory
  const StockToChain2 = await hre.ethers.getContractFactory("StockToChain2");

  // Get deployment parameters from environment variables
  const eurUsdPriceFeed = process.env.EUR_USD_PRICE_FEED;
  const polUsdPriceFeed = process.env.POL_USD_PRICE_FEED;
  const companyWallet = process.env.COMPANY_WALLET;
  const platformWallet = process.env.PLATFORM_WALLET;

  // Validate parameters
  if (!eurUsdPriceFeed || !polUsdPriceFeed || !companyWallet || !platformWallet) {
    throw new Error("Missing required environment variables");
  }

  // Validate addresses
  if (!hre.ethers.isAddress(eurUsdPriceFeed) || !hre.ethers.isAddress(polUsdPriceFeed) || 
      !hre.ethers.isAddress(companyWallet) || !hre.ethers.isAddress(platformWallet)) {
    throw new Error("Invalid address format in environment variables");
  }

  console.log("Starting local deployment test...");
  console.log("Parameters:");
  console.log("- EUR/USD Price Feed:", eurUsdPriceFeed);
  console.log("- POL/USD Price Feed:", polUsdPriceFeed);
  console.log("- Company Wallet:", companyWallet);
  console.log("- Platform Wallet:", platformWallet);

  // Get signers
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Deploy the contract
  console.log("Deploying StockToChain2...");
  const stockToChain2 = await StockToChain2.deploy(
    eurUsdPriceFeed,
    polUsdPriceFeed,
    companyWallet,
    platformWallet,
    { gasLimit: 5000000 } // Add explicit gas limit
  );

  await stockToChain2.waitForDeployment();

  const address = await stockToChain2.getAddress();
  console.log("StockToChain2 deployed to:", address);

  // Test basic functionality
  console.log("\nTesting basic functionality...");
  
  // Test whitelist
  console.log("Testing whitelist...");
  await stockToChain2.addToWhitelist([deployer.address]);
  const isWhitelisted = await stockToChain2.investors(deployer.address).then(i => i.whitelisted);
  console.log("Deployer whitelisted:", isWhitelisted);

  // Test workflow status
  console.log("\nTesting workflow status...");
  const initialStatus = await stockToChain2.workflowStatus();
  console.log("Initial workflow status:", initialStatus);

  // Test price feed
  console.log("\nTesting price feed...");
  const price = await stockToChain2.getCurrentPriceInPOL(1000);
  console.log("Price for 1000 tokens:", price.toString());

  // Test pause functionality
  console.log("\nTesting pause functionality...");
  await stockToChain2.pause();
  const isPaused = await stockToChain2.paused();
  console.log("Contract paused:", isPaused);

  await stockToChain2.unpause();
  const isUnpaused = await stockToChain2.paused();
  console.log("Contract unpaused:", !isUnpaused);

  console.log("\nLocal deployment test completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 