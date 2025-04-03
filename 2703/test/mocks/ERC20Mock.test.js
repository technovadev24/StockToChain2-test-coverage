const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC20Mock", function () {
    let erc20Mock;
    let owner;
    let addr1;
    let addr2;

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
        const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
        erc20Mock = await ERC20Mock.deploy();
        await erc20Mock.waitForDeployment();
    });

    describe("Mint", function () {
        it("Should allow owner to mint tokens", async function () {
            const amount = ethers.parseEther("1000");
            await expect(erc20Mock.connect(owner).mint(addr1.address, amount))
                .to.emit(erc20Mock, "Transfer")
                .withArgs(ethers.ZeroAddress, addr1.address, amount);

            expect(await erc20Mock.balanceOf(addr1.address)).to.equal(amount);
        });

        it("Should allow minting to multiple addresses", async function () {
            const amount = ethers.parseEther("500");
            await erc20Mock.connect(owner).mint(addr1.address, amount);
            await erc20Mock.connect(owner).mint(addr2.address, amount);

            expect(await erc20Mock.balanceOf(addr1.address)).to.equal(amount);
            expect(await erc20Mock.balanceOf(addr2.address)).to.equal(amount);
        });
    });

    describe("Burn", function () {
        it("Should allow owner to burn tokens", async function () {
            const amount = ethers.parseEther("1000");
            // D'abord mint des tokens
            await erc20Mock.connect(owner).mint(addr1.address, amount);
            
            // Puis burn les tokens
            await expect(erc20Mock.connect(owner).burn(addr1.address, amount))
                .to.emit(erc20Mock, "Transfer")
                .withArgs(addr1.address, ethers.ZeroAddress, amount);

            expect(await erc20Mock.balanceOf(addr1.address)).to.equal(0);
        });

        it("Should allow burning partial amount", async function () {
            const mintAmount = ethers.parseEther("1000");
            const burnAmount = ethers.parseEther("500");
            
            // Mint des tokens
            await erc20Mock.connect(owner).mint(addr1.address, mintAmount);
            
            // Burn une partie
            await erc20Mock.connect(owner).burn(addr1.address, burnAmount);

            expect(await erc20Mock.balanceOf(addr1.address)).to.equal(mintAmount - burnAmount);
        });
    });
});
