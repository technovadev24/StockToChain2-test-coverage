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

  console.log("Deploying StockToChain2...");
  console.log("Parameters:");
  console.log("- EUR/USD Price Feed:", eurUsdPriceFeed);
  console.log("- POL/USD Price Feed:", polUsdPriceFeed);
  console.log("- Company Wallet:", companyWallet);
  console.log("- Platform Wallet:", platformWallet);

  // Deploy the contract
  const stockToChain2 = await StockToChain2.deploy(
    eurUsdPriceFeed,
    polUsdPriceFeed,
    companyWallet,
    platformWallet
  );

  await stockToChain2.waitForDeployment();

  const address = await stockToChain2.getAddress();
  console.log("StockToChain2 deployed to:", address);

  // Wait for a few block confirmations
  console.log("Waiting for block confirmations...");
  await stockToChain2.deploymentTransaction().wait(5);
  console.log("Confirmed!");

  // Verify the contract
  console.log("Verifying contract...");
  try {
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: [
        eurUsdPriceFeed,
        polUsdPriceFeed,
        companyWallet,
        platformWallet
      ],
    });
    console.log("Contract verified successfully!");
  } catch (error) {
    console.error("Error verifying contract:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 