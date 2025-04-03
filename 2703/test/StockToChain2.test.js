const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("StockToChain2 Contract", function () {
    async function deployStockToChain2Fixture() {
        const [owner, addr1, addr2, addr3, companyWallet, platformWallet] = await ethers.getSigners();

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
            addr3,
            companyWallet,
            platformWallet,
            eurUsdPriceFeed,
            polUsdPriceFeed
        };
    }

    beforeEach(async function () {
        ({ stockToChain2, owner, addr1, addr2, addr3, companyWallet, platformWallet, eurUsdPriceFeed, polUsdPriceFeed } = await loadFixture(deployStockToChain2Fixture));
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

        it("Should allow owner to remove addresses from whitelist", async function () {
            // Ajout d'investisseurs à la whitelist
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address, addr2.address]);
            
            // Vérification que les investisseurs sont bien dans la whitelist
            expect((await stockToChain2.investors(addr1.address)).whitelisted).to.be.true;
            expect((await stockToChain2.investors(addr2.address)).whitelisted).to.be.true;

            // Suppression des investisseurs de la whitelist
            await expect(stockToChain2.connect(companyWallet).removeFromWhitelist([addr1.address, addr2.address]))
                .to.emit(stockToChain2, "InvestorRemovedFromWhitelist")
                .withArgs(addr1.address)
                .to.emit(stockToChain2, "InvestorRemovedFromWhitelist")
                .withArgs(addr2.address);

            // Vérification que les investisseurs ont été retirés de la whitelist
            expect((await stockToChain2.investors(addr1.address)).whitelisted).to.be.false;
            expect((await stockToChain2.investors(addr2.address)).whitelisted).to.be.false;
        });

        it("Should not allow non-owner to remove addresses from whitelist", async function () {
            await expect(stockToChain2.connect(addr1).removeFromWhitelist([addr2.address]))
                .to.be.revertedWithCustomError(stockToChain2, "OwnableUnauthorizedAccount");
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
            await expect(stockToChain2.connect(companyWallet).buybackByCompanyBatch(0, 1, { value: buybackPrice }))
                .to.be.revertedWith("Buyback not active");
        });
    });

    describe("Buyback (Batch)", function () {
        beforeEach(async function () {
            // Configuration initiale : whitelist et achat de tokens
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address, addr2.address, addr3.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1); // SaleActive

            // Chaque investisseur achète 1 token
            for (let addr of [addr1, addr2, addr3]) {
                const amount = ethers.parseEther("1");
                const price = await stockToChain2.getCurrentPriceInPOL(amount);
                await stockToChain2.connect(addr).buyTokens(amount, { value: price });
            }

            // Transition vers BuybackActive
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(2); // SaleEnded
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(3); // BuybackActive
        });

        it("Should execute buyback in 2 batches and burn tokens", async function () {
            const totalTokens = await stockToChain2.totalSupply();
            console.log("Total tokens before buyback:", ethers.formatEther(totalTokens));
            
            // Transfert des tokens au contrat
            for (let addr of [addr1, addr2, addr3]) {
                const amount = ethers.parseEther("1");
                await stockToChain2.connect(addr).transfer(await stockToChain2.getAddress(), amount);
            }
            
            const buybackPrice = await stockToChain2.getBuybackPriceInPOL(totalTokens);
            const extra = ethers.parseEther("0.1");
            const totalFunds = buybackPrice + extra;
            const fundsPerBatch = totalFunds / 2n;

            // Batch 1: addr1, addr2
            await stockToChain2.connect(companyWallet).buybackByCompanyBatch(0, 2, { value: fundsPerBatch });

            // Batch 2: addr3 + final burn
            await expect(stockToChain2.connect(companyWallet).buybackByCompanyBatch(2, 3, { value: fundsPerBatch }))
                .to.emit(stockToChain2, "BuybackExecuted");

            // Vérifie que tous les tokens sont brûlés
            expect(await stockToChain2.totalSupply()).to.equal(0);
        });

        it("Should revert batch if out-of-range indexes are used", async function () {
            const amount = await stockToChain2.getBuybackPriceInPOL(await stockToChain2.totalSupply());
            await expect(
                stockToChain2.connect(companyWallet).buybackByCompanyBatch(0, 5, { value: amount })
            ).to.be.revertedWith("Invalid index range");
        });

        it("Should revert if buyback batch is called without enough funds in first batch", async function () {
            const price = (await stockToChain2.getBuybackPriceInPOL(await stockToChain2.totalSupply())) - 1n;
            await expect(
                stockToChain2.connect(companyWallet).buybackByCompanyBatch(0, 2, { value: price })
            ).to.be.revertedWith("Insufficient funds for buyback");
        });

        it("Should revert if not BuybackActive", async function () {
            // On teste avec un nouveau contrat dans l'état initial
            const { stockToChain2: newStockToChain2 } = await loadFixture(deployStockToChain2Fixture);
            const amount = ethers.parseEther("1");
            await expect(newStockToChain2.connect(companyWallet).buybackByCompanyBatch(0, 1, { value: amount }))
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
            // Configuration initiale
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1); // SaleActive
            
            // Achat de tokens
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });
            
            // Transfert des tokens à un autre compte pour simuler qu'il n'y a pas de tokens à racheter
            await stockToChain2.connect(addr1).transfer(addr2.address, amount);
            
            // Transition vers BuybackActive
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(2); // SaleEnded
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(3); // BuybackActive

            const buybackPrice = await stockToChain2.getBuybackPriceInPOL(amount);
            await expect(stockToChain2.connect(companyWallet).buybackByCompanyBatch(0, 1, { value: buybackPrice }))
            .to.be.revertedWithCustomError(stockToChain2, "NoTokensToBuyBack");

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

        it("Should allow emergencyWithdraw of MATIC", async function () {
            // Envoi de MATIC au contrat
            const amount = ethers.parseEther("1");
            await companyWallet.sendTransaction({
                to: await stockToChain2.getAddress(),
                value: amount
            });

            const balanceBefore = await ethers.provider.getBalance(companyWallet.address);
            await stockToChain2.connect(companyWallet).emergencyWithdraw(ethers.ZeroAddress);
            const balanceAfter = await ethers.provider.getBalance(companyWallet.address);

            // Note: On ne peut pas comparer directement les balances car le gas affecte le résultat
            // On vérifie juste que le transfert a été effectué
            expect(balanceAfter).to.be.gt(balanceBefore);
        });

        it("Should allow the owner to unpause the contract", async function () {
            // On pause d'abord le contrat
            await stockToChain2.connect(companyWallet).pause();
        
            // Vérifie qu'il est bien en pause
            expect(await stockToChain2.paused()).to.be.true;
        
            // Puis on le déverrouille
            await stockToChain2.connect(companyWallet).unpause();
        
            // Vérifie qu'il est bien déverrouillé
            expect(await stockToChain2.paused()).to.be.false;
        });

        it("Should return correct investment summary", async function () {
            // Configuration initiale
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1); // SaleActive
            
            // Achat de tokens
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });

            // Récupération du résumé d'investissement
            const summary = await stockToChain2.getInvestmentSummary(addr1.address);
            const investor = await stockToChain2.investors(addr1.address);
            const expectedClaimTime = investor.lastPurchaseTime + BigInt(4 * 365 * 24 * 60 * 60);
            
            // Vérification des valeurs
            expect(summary.balance).to.equal(amount);
            expect(summary.unclaimedProfit).to.equal(0);
            expect(summary.profitClaimTime).to.equal(expectedClaimTime);
            expect(summary.isWhitelisted).to.be.true;
            expect(summary.totalInvested).to.equal(price);
        });
    });
});
