const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("MockV3Aggregator", function () {
    let mockAggregator;
    let owner;
    const initialAnswer = 2000 * 10**8; // 2000 USD avec 8 décimales
    const decimals = 8;

    beforeEach(async function () {
        [owner] = await ethers.getSigners();
        const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
        mockAggregator = await MockV3Aggregator.deploy(decimals, initialAnswer);
        await mockAggregator.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set the correct decimals", async function () {
            expect(await mockAggregator.decimals()).to.equal(decimals);
        });

        it("Should set the correct initial answer", async function () {
            const roundData = await mockAggregator.latestRoundData();
            expect(roundData.answer).to.equal(initialAnswer);
        });

        it("Should set the correct initial timestamp", async function () {
            const roundData = await mockAggregator.latestRoundData();
            expect(roundData.updatedAt).to.be.gt(0);
        });
    });

    describe("Update Answer", function () {
        it("Should update the answer correctly", async function () {
            const newAnswer = 250000000000; // 2500 avec 8 décimales
            await mockAggregator.updateAnswer(newAnswer);
            const roundData = await mockAggregator.latestRoundData();
            expect(roundData.answer).to.equal(newAnswer);
        });

        it("Should update the timestamp when updating answer", async function () {
            const roundDataBefore = await mockAggregator.latestRoundData();
            await mockAggregator.updateAnswer(250000000000);
            const roundDataAfter = await mockAggregator.latestRoundData();
            expect(roundDataAfter.updatedAt).to.be.gt(roundDataBefore.updatedAt);
        });
    });

    describe("Round Data", function () {
        it("Should return correct round data", async function () {
            const roundData = await mockAggregator.latestRoundData();
            expect(roundData.answer).to.equal(initialAnswer);
            expect(roundData.startedAt).to.be.gt(0);
            expect(roundData.updatedAt).to.be.gt(0);
            expect(roundData.answeredInRound).to.be.gt(0);
        });

        it("Should return correct description", async function () {
            expect(await mockAggregator.description()).to.equal("Mock V3 Aggregator");
        });

        it("Should return correct version", async function () {
            expect(await mockAggregator.version()).to.equal(3);
        });
    });

    describe("getRoundData", function () {
        it("Should return correct round data for a specific round", async function () {
            const roundId = 1;
            const [returnedRoundId, answer, startedAt, updatedAt, answeredInRound] = 
                await mockAggregator.getRoundData(roundId);

            expect(returnedRoundId).to.equal(roundId);
            expect(answer).to.equal(initialAnswer);
            expect(startedAt).to.equal(updatedAt);
            expect(answeredInRound).to.equal(roundId);
        });

        it("Should return updated data after updating answer", async function () {
            const roundId = 1;
            const newAnswer = 2100 * 10**8; // 2100 USD
            await mockAggregator.updateAnswer(newAnswer);

            const [returnedRoundId, answer, startedAt, updatedAt, answeredInRound] = 
                await mockAggregator.getRoundData(roundId);

            expect(returnedRoundId).to.equal(roundId);
            expect(answer).to.equal(newAnswer); // La valeur devrait être mise à jour
            expect(startedAt).to.equal(updatedAt);
            expect(answeredInRound).to.equal(roundId);
        });
    });
}); 