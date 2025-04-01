const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("MockV3Aggregator", function () {
    async function deployMockV3AggregatorFixture() {
        const [owner] = await ethers.getSigners();
        
        // Déployer le contrat avec 8 décimales et un prix initial de 2000
        const decimals = 8;
        const initialAnswer = 200000000000; // 2000 avec 8 décimales
        const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
        const mockV3Aggregator = await MockV3Aggregator.deploy(decimals, initialAnswer);

        return { mockV3Aggregator, owner, decimals, initialAnswer };
    }

    beforeEach(async function () {
        ({ mockV3Aggregator, owner, decimals, initialAnswer } = await loadFixture(deployMockV3AggregatorFixture));
    });

    describe("Deployment", function () {
        it("Should set the correct decimals", async function () {
            expect(await mockV3Aggregator.decimals()).to.equal(decimals);
        });

        it("Should set the correct initial answer", async function () {
            const roundData = await mockV3Aggregator.latestRoundData();
            expect(roundData.answer).to.equal(initialAnswer);
        });

        it("Should set the correct initial timestamp", async function () {
            const roundData = await mockV3Aggregator.latestRoundData();
            expect(roundData.updatedAt).to.be.gt(0);
        });
    });

    describe("Update Answer", function () {
        it("Should update the answer correctly", async function () {
            const newAnswer = 250000000000; // 2500 avec 8 décimales
            await mockV3Aggregator.updateAnswer(newAnswer);
            const roundData = await mockV3Aggregator.latestRoundData();
            expect(roundData.answer).to.equal(newAnswer);
        });

        it("Should update the timestamp when updating answer", async function () {
            const roundDataBefore = await mockV3Aggregator.latestRoundData();
            await mockV3Aggregator.updateAnswer(250000000000);
            const roundDataAfter = await mockV3Aggregator.latestRoundData();
            expect(roundDataAfter.updatedAt).to.be.gt(roundDataBefore.updatedAt);
        });
    });

    describe("Round Data", function () {
        it("Should return correct round data", async function () {
            const roundData = await mockV3Aggregator.latestRoundData();
            expect(roundData.answer).to.equal(initialAnswer);
            expect(roundData.startedAt).to.be.gt(0);
            expect(roundData.updatedAt).to.be.gt(0);
            expect(roundData.answeredInRound).to.be.gt(0);
        });
    });
}); 