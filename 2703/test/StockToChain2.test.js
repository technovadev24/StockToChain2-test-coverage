const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("StockToChain2 Contract", function () {
    async function deployStockToChain2Fixture() {
        const [owner, addr1, addr2, companyWallet, platformWallet] = await ethers.getSigners();

        const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
        const eurUsdPriceFeed = await MockV3Aggregator.deploy(8, 100000000); // 1 EUR
        await eurUsdPriceFeed.waitForDeployment();
        const polUsdPriceFeed = await MockV3Aggregator.deploy(8, 100000000); // 1 POL
        await polUsdPriceFeed.waitForDeployment();

        const StockToChain2 = await ethers.getContractFactory("StockToChain2");
        const stockToChain2 = await StockToChain2.deploy(
            await eurUsdPriceFeed.getAddress(),
            await polUsdPriceFeed.getAddress(),
            companyWallet.address,
            platformWallet.address
        );
        await stockToChain2.waitForDeployment();

        return {
            stockToChain2,
            owner,
            addr1,
            addr2,
            companyWallet,
            platformWallet,
            eurUsdPriceFeed,
            polUsdPriceFeed
        };
    }

    beforeEach(async function () {
        ({ stockToChain2, owner, addr1, addr2, companyWallet, platformWallet, eurUsdPriceFeed, polUsdPriceFeed } = await loadFixture(deployStockToChain2Fixture));
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await stockToChain2.owner()).to.equal(companyWallet.address);
        });

        it("Should set the correct workflow status", async function () {
            expect(await stockToChain2.workflowStatus()).to.equal(0);
        });

        it("Should set the correct platform wallet", async function () {
            expect(await stockToChain2.platformWallet()).to.equal(platformWallet.address);
        });
    });

    describe("Whitelist Management", function () {
        it("Should allow owner to add addresses to whitelist", async function () {
            await expect(stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]))
                .to.emit(stockToChain2, "InvestorWhitelisted").withArgs(addr1.address);
            expect((await stockToChain2.investors(addr1.address)).whitelisted).to.be.true;
        });

        it("Should not allow non-owner to add addresses to whitelist", async function () {
            await expect(stockToChain2.connect(addr1).addToWhitelist([addr2.address]))
                .to.be.revertedWithCustomError(stockToChain2, "OwnableUnauthorizedAccount");
        });

        it("Should allow adding multiple addresses to whitelist", async function () {
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address, addr2.address]);
            expect((await stockToChain2.investors(addr1.address)).whitelisted).to.be.true;
            expect((await stockToChain2.investors(addr2.address)).whitelisted).to.be.true;
        });
    });

    describe("Token Sale", function () {
        beforeEach(async function () {
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);
        });

        it("Should allow whitelisted users to buy tokens", async function () {
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await expect(stockToChain2.connect(addr1).buyTokens(amount, { value: price }))
                .to.emit(stockToChain2, "TokensPurchased").withArgs(addr1.address, amount, price);
        });

        it("Should not allow non-whitelisted users to buy tokens", async function () {
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await expect(stockToChain2.connect(addr2).buyTokens(amount, { value: price }))
                .to.be.revertedWith("Address not whitelisted");
        });

        it("Should not allow buying tokens when sale is not active", async function () {
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(2);
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await expect(stockToChain2.connect(addr1).buyTokens(amount, { value: price }))
                .to.be.revertedWith("Sale is not active");
        });

        it("Should not allow buying more tokens than total supply", async function () {
            const amount = ethers.parseEther("85000");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await expect(stockToChain2.connect(addr1).buyTokens(amount, { value: price }))
                .to.be.revertedWith("Exceeds total supply");
        });
    });

    describe("Profit Distribution", function () {
        beforeEach(async function () {
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });
        });

        it("Should allow owner to distribute profits", async function () {
            const value = ethers.parseEther("1");
            await expect(stockToChain2.connect(companyWallet).distributeProfits({ value }))
                .to.emit(stockToChain2, "ProfitsDistributed").withArgs(value);
        });

        it("Should not allow non-owner to distribute profits", async function () {
            const value = ethers.parseEther("1");
            await expect(stockToChain2.connect(addr1).distributeProfits({ value }))
                .to.be.revertedWithCustomError(stockToChain2, "OwnableUnauthorizedAccount");
        });

        it("Should not allow distributing zero profits", async function () {
            await expect(stockToChain2.connect(companyWallet).distributeProfits({ value: 0 }))
                .to.be.revertedWith("No profits to distribute");
        });
    });

    describe("Profit Claims", function () {
        it("Should not allow claiming profits before waiting period", async function () {
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);

            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });

            const profitAmount = ethers.parseEther("1");
            await stockToChain2.connect(companyWallet).distributeProfits({ value: profitAmount });

            const investor = await stockToChain2.investors(addr1.address);
            console.log("Unclaimed profits before waiting:", investor.unclaimedProfits.toString());
            expect(investor.unclaimedProfits).to.be.gt(0);

            await expect(stockToChain2.connect(addr1).claimProfits())
                .to.be.revertedWith("Must wait 4 years before claiming profits");
        });

        it("Should allow claiming profits after waiting period", async function () {
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);

            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });

            const profitAmount = ethers.parseEther("1");
            await stockToChain2.connect(companyWallet).distributeProfits({ value: profitAmount });

            await ethers.provider.send("evm_increaseTime", [4 * 365 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine");

            const share = await stockToChain2.calculateInvestorProfitShare(addr1.address);
            console.log("Profit share after 4 years:", ethers.formatEther(share));
            expect(share).to.be.gt(0);

            await expect(stockToChain2.connect(addr1).claimProfits())
                .to.emit(stockToChain2, "ProfitsClaimed")
                .withArgs(addr1.address, share);
        });
    });
  
        

    describe("Buyback", function () {
        it("Should not allow buyback when not in buyback phase", async function () {
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(2);
            const buybackPrice = await stockToChain2.getBuybackPriceInPOL(amount);
            await expect(stockToChain2.connect(companyWallet).buybackByCompany({ value: buybackPrice }))
                .to.be.revertedWith("Buyback not active");
        });
    });

    describe("Additional Coverage Tests", function () {
        it("Should refund excess MATIC after token purchase", async function () {
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);

            const amount = ethers.parseEther("1");
            const priceInPol = await stockToChain2.getCurrentPriceInPOL(amount);
            const excessAmount = ethers.parseEther("0.1");
            const totalAmount = priceInPol + excessAmount;

            const balanceBefore = await ethers.provider.getBalance(addr1.address);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: totalAmount });
            const balanceAfter = await ethers.provider.getBalance(addr1.address);

            expect(balanceAfter).to.be.gt(balanceBefore - totalAmount);
        });

        it("Should revert buyback if no investors have tokens", async function () {
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1); // SaleActive
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(2); // SaleEnded
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(3); // BuybackActive

            const buybackPrice = await stockToChain2.getBuybackPriceInPOL(ethers.parseEther("1"));
            await expect(stockToChain2.connect(companyWallet).buybackByCompany({ value: buybackPrice }))
                .to.be.revertedWith("No tokens to buy back");
        });

        it("Should allow emergencyWithdraw of ERC20 token", async function () {
            const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
            const mockToken = await ERC20Mock.deploy();
            await mockToken.waitForDeployment();

            const amount = ethers.parseEther("1000");
            await mockToken.transfer(await stockToChain2.getAddress(), amount);

            const balanceBefore = await mockToken.balanceOf(companyWallet.address);
            await stockToChain2.connect(companyWallet).emergencyWithdraw(await mockToken.getAddress());
            const balanceAfter = await mockToken.balanceOf(companyWallet.address);

            expect(balanceAfter).to.equal(balanceBefore + amount);
        });
    });
    
});
