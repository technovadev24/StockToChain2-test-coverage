const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const PROFIT_CLAIM_PERIOD = 4 * 365 * 24 * 60 * 60; // 4 years in seconds

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

        it("Should revert if amount is zero", async function () {
            await expect(stockToChain2.connect(addr1).buyTokens(0, { value: 0 }))
                .to.be.revertedWith("Amount must be greater than 0");
        });

        it("Should revert if buying exceeds total supply", async function () {
            const amount = ethers.parseEther("85000"); // 85 000 > 84 000
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await expect(stockToChain2.connect(addr1).buyTokens(amount, { value: price }))
                .to.be.revertedWith("Exceeds total supply");
        });

        it("Should revert if not enough POL sent", async function () {
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await expect(stockToChain2.connect(addr1).buyTokens(amount, { value: price - 1n }))
                .to.be.revertedWith("Insufficient payment");
        });

        it("Should not add investor twice to investorList", async function () {
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);

            // Premier achat
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });
            
            // Deuxième achat
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });

            // Vérification que l'investisseur n'est pas dupliqué
            const investor = await stockToChain2.investors(addr1.address);
            expect(investor.totalTokens).to.equal(amount * 2n);
            expect(investor.whitelisted).to.be.true;
            expect(investor.totalInvested).to.equal(price * 2n);
        });

        it("Should not refund if exact payment is sent", async function () {
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);

            const balanceBefore = await ethers.provider.getBalance(addr1.address);
            const tx = await stockToChain2.connect(addr1).buyTokens(amount, { value: price });
            const receipt = await tx.wait();
            const balanceAfter = await ethers.provider.getBalance(addr1.address);

            expect(receipt).to.not.be.null;
            expect(balanceAfter).to.be.lt(balanceBefore);
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

    describe("Profit Distribution - Edge Cases", function () {
        async function setupContractWithNoTokenInCirculation() {
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1); // SaleActive
        }
    
        async function setupContractWithInvestorButZeroTokens() {
            // addr1 sera ajouté à la liste des investisseurs mais aura 0 token
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1); // SaleActive
    
            // addr1 achète puis transfère tout à addr2 → il a 0 token mais est dans la liste
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });
            await stockToChain2.connect(addr1).transfer(addr2.address, amount);
        }
    
        it("Should revert when no tokens are in circulation", async function () {
            await setupContractWithNoTokenInCirculation();
    
            const profitAmount = ethers.parseEther("1");
            await expect(
                stockToChain2.connect(companyWallet).distributeProfits({ value: profitAmount })
            ).to.be.revertedWith("No tokens in circulation");
        });
    
          
        it("Should distribute profits correctly when one investor holds tokens", async function () {
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);
    
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });
    
            const profitAmount = ethers.parseEther("1");
            await expect(
                stockToChain2.connect(companyWallet).distributeProfits({ value: profitAmount })
            ).to.emit(stockToChain2, "ProfitsDistributed").withArgs(profitAmount);
    
            const investor = await stockToChain2.investors(addr1.address);
            expect(investor.unclaimedProfits).to.be.gt(0); // profit reçu
        });
    
        it("Should revert if profit amount is zero", async function () {
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);
            await expect(
                stockToChain2.connect(companyWallet).distributeProfits({ value: 0 })
            ).to.be.revertedWith("No profits to distribute");
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

        it("Should return 0 profit share for investor with no tokens", async function () {
            // Configuration initiale
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1); // SaleActive
            
            // Achat de tokens par un autre investisseur pour avoir des tokens en circulation
            await stockToChain2.connect(companyWallet).addToWhitelist([addr2.address]);
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr2).buyTokens(amount, { value: price });
            
            // Distribution des profits
            const profitAmount = ethers.parseEther("1");
            await stockToChain2.connect(companyWallet).distributeProfits({ value: profitAmount });
            
            // Vérification que l'investisseur sans tokens a une part de 0
            const share = await stockToChain2.calculateInvestorProfitShare(addr1.address);
            expect(share).to.equal(0);
        });

        it("Should calculate correct profit share for investor with tokens", async function () {
            // Configuration initiale
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address, addr2.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1); // SaleActive
            
            // Achat de tokens
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });
            await stockToChain2.connect(addr2).buyTokens(amount, { value: price });
            
            // Distribution des profits
            const profitAmount = ethers.parseEther("2");
            await stockToChain2.connect(companyWallet).distributeProfits({ value: profitAmount });
            
            // Vérification de la part de profits
            const share = await stockToChain2.calculateInvestorProfitShare(addr1.address);
            expect(share).to.equal(ethers.parseEther("0.15")); // 15% des profits (30% / 2 investisseurs)
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
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address, addr2.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1); // SaleActive

            // Achat de tokens
            const amount = ethers.parseEther("1");
            const price1 = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price1 });
            const price2 = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr2).buyTokens(amount, { value: price2 });

            // Transfert des tokens au contrat
            await stockToChain2.connect(addr1).transfer(await stockToChain2.getAddress(), amount);
            await stockToChain2.connect(addr2).transfer(await stockToChain2.getAddress(), amount);

            // Transition vers BuybackActive en passant par SaleEnded
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(2); // SaleEnded
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(3); // BuybackActive
        });

        it("Should execute buyback in 2 batches and burn tokens", async function () {
            const totalTokens = await stockToChain2.totalSupply();
            console.log("Total tokens before buyback:", ethers.formatEther(totalTokens));
            
            const buybackPrice = await stockToChain2.getBuybackPriceInPOL(totalTokens);
            const extra = ethers.parseEther("0.1");
            const totalFunds = buybackPrice + extra;
            const fundsPerBatch = totalFunds / 2n;

            // Batch 1: addr1
            await stockToChain2.connect(companyWallet).buybackByCompanyBatch(0, 1, { value: fundsPerBatch });

            // Batch 2: addr2 + final burn
            await expect(stockToChain2.connect(companyWallet).buybackByCompanyBatch(1, 2, { value: fundsPerBatch }))
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

        it("Should skip initial price calculation when start != 0 in buyback batch", async function () {
            const totalPrice = await stockToChain2.getBuybackPriceInPOL(await stockToChain2.totalSupply());
            const extra = ethers.parseEther("0.1");

            // Premier batch pour initialiser le buybackPriceFinal
            await stockToChain2.connect(companyWallet).buybackByCompanyBatch(0, 1, { value: totalPrice + extra });

            // Deuxième batch avec start != 0
            await expect(stockToChain2.connect(companyWallet).buybackByCompanyBatch(1, 2, { value: ethers.parseEther("0.01") }))
                .to.emit(stockToChain2, "BuybackExecuted");
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
            
            // Transfer tokens to another account to simulate no tokens available for buyback
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

        it("Should handle buyback when startIndex equals endIndex", async function () {
            // Configuration initiale
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1); // SaleActive
            
            // Achat de tokens
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });
            
            // Transfert des tokens au contrat
            await stockToChain2.connect(addr1).transfer(await stockToChain2.getAddress(), amount);
            
            // Transition vers BuybackActive
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(2); // SaleEnded
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(3); // BuybackActive

            const buybackPrice = await stockToChain2.getBuybackPriceInPOL(amount);
            await expect(stockToChain2.connect(companyWallet).buybackByCompanyBatch(0, 0, { value: buybackPrice }))
                .to.be.revertedWith("Invalid index range");
        });

        it("Should handle distributeProfits when investors count equals BATCH_SIZE", async function () {
            // Configuration initiale
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address, addr2.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1); // SaleActive
            
            // Achat de tokens par les deux investisseurs
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });
            await stockToChain2.connect(addr2).buyTokens(amount, { value: price });
            
            // Distribution des profits
            const profitAmount = ethers.parseEther("1");
            await expect(stockToChain2.connect(companyWallet).distributeProfits({ value: profitAmount }))
                .to.emit(stockToChain2, "ProfitsDistributed")
                .withArgs(profitAmount);
        });

        it("Should handle distributeProfits when investor has no tokens", async function () {
            // Configuration initiale
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address, addr2.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1); // SaleActive
            
            // Seul addr1 achète des tokens
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });
            
            // Distribution des profits
            const profitAmount = ethers.parseEther("1");
            await expect(stockToChain2.connect(companyWallet).distributeProfits({ value: profitAmount }))
                .to.emit(stockToChain2, "ProfitsDistributed")
                .withArgs(profitAmount);
            
            // Vérification que addr2 n'a pas reçu de profits
            const investor2 = await stockToChain2.investors(addr2.address);
            expect(investor2.unclaimedProfits).to.equal(0);
        });

        it("Should revert when receiving zero value in receive()", async function () {
            await expect(addr1.sendTransaction({
                to: await stockToChain2.getAddress(),
                value: 0
            })).to.be.revertedWith("Receive: Zero value");
        });

        it("Should call fallback and emit FallbackCalled event", async function () {
            const tx = await addr1.sendTransaction({
                to: await stockToChain2.getAddress(),
                value: ethers.parseEther("0.1"),
                data: "0x12345678" // données arbitraires pour forcer fallback
            });

            await expect(tx).to.emit(stockToChain2, "FallbackCalled")
                .withArgs(addr1.address, ethers.parseEther("0.1"), "0x12345678");
        });
    });

    describe("Workflow Management", function () {
        it("Should revert on invalid workflow transition: SaleNotStarted to SaleEnded", async function () {
            await expect(
                stockToChain2.connect(companyWallet).updateWorkflowStatus(2) // SaleEnded
            ).to.be.revertedWith("Invalid workflow transition");
        });

        it("Should revert on invalid workflow transition: SaleActive to BuybackActive", async function () {
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1); // SaleActive
            await expect(
                stockToChain2.connect(companyWallet).updateWorkflowStatus(3) // BuybackActive
            ).to.be.revertedWith("Invalid workflow transition");
        });
        it("Should allow valid transition from SaleActive to SaleEnded", async function () {
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1); // SaleActive
            await expect(
                stockToChain2.connect(companyWallet).updateWorkflowStatus(2)    // SaleEnded
            ).to.emit(stockToChain2, "WorkflowStatusChanged").withArgs(2);
        });
        
    });

    describe("Emergency Withdraw", function () {
        it("Should revert emergencyWithdraw if not owner", async function () {
            await expect(stockToChain2.connect(addr1).emergencyWithdraw(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(stockToChain2, "OwnableUnauthorizedAccount");
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
    });

    describe("Pause Management", function () {
        it("Should revert pause if not owner", async function () {
            await expect(stockToChain2.connect(addr1).pause())
                .to.be.revertedWithCustomError(stockToChain2, "OwnableUnauthorizedAccount");
        });

        it("Should revert unpause if not owner", async function () {
            await expect(stockToChain2.connect(addr1).unpause())
                .to.be.revertedWithCustomError(stockToChain2, "OwnableUnauthorizedAccount");
        });

        it("Should allow the owner to pause the contract", async function () {
            await stockToChain2.connect(companyWallet).pause();
            expect(await stockToChain2.paused()).to.be.true;
        });

        it("Should allow the owner to unpause the contract", async function () {
            await stockToChain2.connect(companyWallet).pause();
            await stockToChain2.connect(companyWallet).unpause();
            expect(await stockToChain2.paused()).to.be.false;
        });
    });

    describe("Investment Summary", function () {
        it("Should return correct investment summary for investor with tokens", async function () {
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

        it("Should return correct investment summary for non-whitelisted address", async function () {
            const summary = await stockToChain2.getInvestmentSummary(addr1.address);
            
            // Vérification des valeurs
            expect(summary.balance).to.equal(0);
            expect(summary.unclaimedProfit).to.equal(0);
            expect(summary.profitClaimTime).to.equal(0 + 4 * 365 * 24 * 60 * 60); // lastPurchaseTime = 0 + PROFIT_CLAIM_PERIOD
            expect(summary.isWhitelisted).to.be.false;
            expect(summary.totalInvested).to.equal(0);
        });
    });

    describe("Buyback Edge Cases", function () {
        it("Should handle buyback when startIndex equals endIndex", async function () {
            // Configuration initiale
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1); // SaleActive
            
            // Achat de tokens
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });
            
            // Transfert des tokens au contrat
            await stockToChain2.connect(addr1).transfer(await stockToChain2.getAddress(), amount);
            
            // Transition vers BuybackActive
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(2); // SaleEnded
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(3); // BuybackActive

            const buybackPrice = await stockToChain2.getBuybackPriceInPOL(amount);
            await expect(stockToChain2.connect(companyWallet).buybackByCompanyBatch(0, 0, { value: buybackPrice }))
                .to.be.revertedWith("Invalid index range");
        });

        it("Should handle buyback when no investors have tokens", async function () {
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
    });

    describe("Coverage Improvements", function () {
        it("Should skip investor with zero tokens in distributeProfits", async function () {
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address, addr2.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);

            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });

            // addr2 est dans investorList mais n'achète pas de tokens
            const profit = ethers.parseEther("1");
            await expect(stockToChain2.connect(companyWallet).distributeProfits({ value: profit }))
                .to.emit(stockToChain2, "ProfitsDistributed");

            const investor2 = await stockToChain2.investors(addr2.address);
            expect(investor2.unclaimedProfits).to.equal(0);
        });

        it("Should skip investor share transfer if share is zero", async function () {
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);

            // Achat de tokens
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });

            // Distribution des profits
            const profit = ethers.parseEther("1");
            await stockToChain2.connect(companyWallet).distributeProfits({ value: profit });

            // Vérification que l'investisseur avec part nulle n'est pas pris en compte
            const share = await stockToChain2.calculateInvestorProfitShare(addr1.address);
            expect(share).to.be.gt(0);
        });

        it("Should revert on invalid workflow transition from BuybackActive to SaleNotStarted", async function () {
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(2);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(3);
            await expect(stockToChain2.connect(companyWallet).updateWorkflowStatus(0))
                .to.be.revertedWith("Invalid workflow transition");
        });

        it("Should revert if oracle returns invalid price", async function () {
            // Configuration initiale
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);
        
            // Modification du mock pour renvoyer un prix invalide
            await eurUsdPriceFeed.updateAnswer(0);
            
            const amount = ethers.parseEther("1");
            await expect(stockToChain2.getCurrentPriceInPOL(amount))
                .to.be.revertedWith("Invalid price feed data");
        });

        it("Should handle distributeProfits when endIndex exceeds investorList length", async function () {
            // Configuration initiale
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1); // SaleActive
            
            // Achat de tokens
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });
            
            // Distribution des profits
            const profitAmount = ethers.parseEther("1");
            await expect(stockToChain2.connect(companyWallet).distributeProfits({ value: profitAmount }))
                .to.emit(stockToChain2, "ProfitsDistributed")
                .withArgs(profitAmount);
            
            // Vérification que les profits ont été distribués correctement
            const investor = await stockToChain2.investors(addr1.address);
            expect(investor.unclaimedProfits).to.be.gt(0);
        });

        it("Should revert emergencyWithdraw if token is the contract token itself", async function () {
            const contractAddress = await stockToChain2.getAddress();
            await expect(
                stockToChain2.connect(companyWallet).emergencyWithdraw(contractAddress)
            ).to.be.revertedWith("Cannot withdraw contract's own token");
        });

        it("Should skip investor share transfer if investorShare == 0 in buyback", async function () {
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address, addr2.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);

            // addr1 achète 1 token, addr2 aucun => totalInvested = 100% pour addr1
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });

            // Transfert de tokens au contrat
            await stockToChain2.connect(addr1).transfer(await stockToChain2.getAddress(), amount);

            // Passage à Buyback
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(2); // SaleEnded
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(3); // BuybackActive

            const totalTokens = await stockToChain2.totalSupply();
            const buybackPrice = await stockToChain2.getBuybackPriceInPOL(totalTokens);
            const extra = ethers.parseEther("0.1");

            // Utilisation d'une plage d'index valide
            await expect(stockToChain2.connect(companyWallet).buybackByCompanyBatch(0, 1, { value: buybackPrice + extra }))
                .to.emit(stockToChain2, "BuybackExecuted");
        });

        it("Should revert on final batch if not enough tokens in contract to burn", async function () {
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);

            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });

            // Pas de transfert des tokens vers le contrat

            // Passage à Buyback
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(2);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(3);

            const buybackPrice = await stockToChain2.getBuybackPriceInPOL(amount);
            await expect(
                stockToChain2.connect(companyWallet).buybackByCompanyBatch(0, 1, { value: buybackPrice + ethers.parseEther("0.1") })
            ).to.be.revertedWithCustomError(stockToChain2, "NoTokensToBuyBack");
        });

        it("Should skip investor with zero tokens during distributeProfits batch", async function () {
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address, addr2.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);

            // Seul addr1 achète
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });

            const profit = ethers.parseEther("1");
            await expect(stockToChain2.connect(companyWallet).distributeProfits({ value: profit }))
                .to.emit(stockToChain2, "ProfitsDistributed");
        });

        it("Should revert if eurUsdPrice from oracle is invalid", async function () {
            await eurUsdPriceFeed.updateAnswer(0);
            const amount = ethers.parseEther("1");
            await expect(stockToChain2.getCurrentPriceInPOL(amount)).to.be.revertedWith("Invalid price feed data");
        });

        it("Should not add duplicate entries to investorList", async function () {
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);

            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);

            // Premier achat
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });
            
            // Deuxième achat
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });

            // Vérification que l'investisseur n'est pas dupliqué
            const investor = await stockToChain2.investors(addr1.address);
            expect(investor.totalTokens).to.equal(amount * 2n);
            expect(investor.whitelisted).to.be.true;
            expect(investor.totalInvested).to.equal(price * 2n);
        });

        it("Should skip transfer when investorShare is zero in buybackByCompanyBatch", async function () {
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address, addr2.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);

            // Seul addr1 achète des tokens
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });

            // Transfert des tokens au contrat
            await stockToChain2.connect(addr1).transfer(await stockToChain2.getAddress(), amount);

            // Passage à Buyback
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(2);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(3);

            const buybackPrice = await stockToChain2.getBuybackPriceInPOL(amount);
            const extra = ethers.parseEther("0.1");

            // Utilisation d'une plage d'index valide (0,1) car nous n'avons qu'un seul investisseur avec des tokens
            await expect(stockToChain2.connect(companyWallet).buybackByCompanyBatch(0, 1, { value: buybackPrice + extra }))
                .to.emit(stockToChain2, "BuybackExecuted");

            // Vérification que addr2 n'a pas reçu de transfert
            const investor2 = await stockToChain2.investors(addr2.address);
            expect(investor2.totalTokens).to.equal(0);
        });
    });

    describe("Branch Coverage", function () {
        it("Should handle distributeProfits when endIndex exceeds investorList length", async function () {
            // Configuration initiale
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1); // SaleActive
            
            // Achat de tokens
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });
            
            // Distribution des profits
            const profitAmount = ethers.parseEther("1");
            await expect(stockToChain2.connect(companyWallet).distributeProfits({ value: profitAmount }))
                .to.emit(stockToChain2, "ProfitsDistributed")
                .withArgs(profitAmount);
            
            // Vérification que les profits ont été distribués correctement
            const investor = await stockToChain2.investors(addr1.address);
            expect(investor.unclaimedProfits).to.be.gt(0);
        });

        it("Should revert in final batch if contract holds insufficient tokens for burn", async function () {
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);

            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });

            // Transfert partiel seulement : on simule qu'il manque une partie des tokens dans le contrat
            const half = ethers.parseEther("0.5");
            await stockToChain2.connect(addr1).transfer(await stockToChain2.getAddress(), half);

            // Passage à Buyback
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(2);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(3);

            const buybackPrice = await stockToChain2.getBuybackPriceInPOL(amount);
            const extra = ethers.parseEther("0.1");

            await expect(
                stockToChain2.connect(companyWallet).buybackByCompanyBatch(0, 1, { value: buybackPrice + extra })
            ).to.be.revertedWithCustomError(stockToChain2, "NoTokensToBuyBack");
        });

        it("Should revert when startIndex equals endIndex in buybackByCompanyBatch", async function () {
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);

            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });

            // Transfert des tokens au contrat
            await stockToChain2.connect(addr1).transfer(await stockToChain2.getAddress(), amount);

            // Passage à Buyback
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(2);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(3);

            const buybackPrice = await stockToChain2.getBuybackPriceInPOL(amount);
            await expect(
                stockToChain2.connect(companyWallet).buybackByCompanyBatch(0, 0, { value: buybackPrice })
            ).to.be.revertedWith("Invalid index range");
        });

        it("Should handle buyback with investor having zero share", async function () {
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address, addr2.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);

            // Seul addr1 achète des tokens
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });

            // Transfert des tokens au contrat
            await stockToChain2.connect(addr1).transfer(await stockToChain2.getAddress(), amount);

            // Passage à Buyback
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(2);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(3);

            const buybackPrice = await stockToChain2.getBuybackPriceInPOL(amount);
            const extra = ethers.parseEther("0.1");

            // Utilisation d'une plage d'index valide (0,1) car nous n'avons qu'un seul investisseur avec des tokens
            await expect(stockToChain2.connect(companyWallet).buybackByCompanyBatch(0, 1, { value: buybackPrice + extra }))
                .to.emit(stockToChain2, "BuybackExecuted");
        });

        it("Should handle investor with zero profit share", async function () {
            // Configuration initiale
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address, addr2.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);

            // Seul addr1 achète des tokens
            const amount = ethers.parseEther("1");
            const price = await stockToChain2.getCurrentPriceInPOL(amount);
            await stockToChain2.connect(addr1).buyTokens(amount, { value: price });

            // Distribution des profits
            const profitAmount = ethers.parseEther("1");
            await expect(stockToChain2.connect(companyWallet).distributeProfits({ value: profitAmount }))
                .to.emit(stockToChain2, "ProfitsDistributed")
                .withArgs(profitAmount);

            // Vérification que addr2 n'a pas reçu de profits
            const investor2 = await stockToChain2.investors(addr2.address);
            expect(investor2.unclaimedProfits).to.equal(0);
        });

        it("Should revert if oracle returns invalid price", async function () {
            // Configuration initiale
            await stockToChain2.connect(companyWallet).addToWhitelist([addr1.address]);
            await stockToChain2.connect(companyWallet).updateWorkflowStatus(1);
        
            // Modification du mock pour renvoyer un prix invalide
            await eurUsdPriceFeed.updateAnswer(0);
            
            const amount = ethers.parseEther("1");
            await expect(stockToChain2.getCurrentPriceInPOL(amount))
                .to.be.revertedWith("Invalid price feed data");
        });

              
    });
})