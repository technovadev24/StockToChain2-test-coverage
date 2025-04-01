# StockToChain2 Smart Contract

## Overview
StockToChain2 is a smart contract designed for tokenizing a distillery's assets with guaranteed buyback and profit distribution features. The contract implements an ERC20 token with a 4-year profit claim period, whitelist functionality, and Chainlink price feeds integration.

## Key Features

### Token Details
- Token Name: StockToChain Token
- Token Symbol: STCT
- Total Supply: 84,000 tokens
- Token Price: 50 EUR per token
- Decimals: 18

### Core Functionalities

#### 1. Whitelist System
- Only whitelisted addresses can participate in the token sale
- Owner can add single or multiple addresses to the whitelist
- KYC verification is required before whitelisting

#### 2. Token Sale
- Controlled sale process with start and end functions
- Tokens can only be purchased during the active sale period
- Price conversion from EUR to POL using Chainlink oracles
- Automatic refund of excess POL sent

#### 3. Profit Distribution
- 60% of profits go to the company
- 30% of profits go to token holders
- 10% of profits go to the platform
- Investors can claim their share of profits after 4 years

#### 4. Guaranteed Buyback
- Company can buy back all tokens at the guaranteed price
- Price calculation based on current EUR/POL exchange rate
- Automatic distribution of buyback funds to token holders

### Security Features
- Pausable functionality for emergency situations
- ReentrancyGuard to prevent reentrancy attacks
- Owner-only administrative functions
- Emergency withdrawal functions for tokens and POL

### Price Feeds
- Integration with Chainlink oracles for:
  - EUR/USD price feed
  - POL/USD price feed
- Automatic price conversion between EUR and POL

## Technical Details

### Dependencies
- OpenZeppelin Contracts
  - ERC20
  - Ownable
  - Pausable
  - ReentrancyGuard
- Chainlink Price Feeds

### Key Functions

#### Token Purchase
```solidity
function buyTokens(uint256 amount) external payable
```
- Allows whitelisted users to purchase tokens
- Converts EUR price to POL using Chainlink oracles
- Handles token transfer and excess POL refund

#### Profit Distribution
```solidity
function distributeProfits() external payable
function claimProfits() external
```
- Owner can distribute profits
- Investors can claim their share of distributed profits after 4 years

#### Buyback
```solidity
function buybackByCompany() external payable
```
- Allows company to buy back all tokens at guaranteed price
- Automatically distributes buyback funds to token holders

### View Functions
- `getCurrentPriceInPOL`: Get current token price in POL
- `calculateInvestorProfitShare`: Calculate investor's profit share
- `getBuybackPriceInPOL`: Get current buyback price in POL
- `getInvestmentSummary`: Get comprehensive investment details

## Events
- `TokensPurchased`: Emitted when tokens are purchased
- `ProfitsDistributed`: Emitted when profits are distributed
- `ProfitsClaimed`: Emitted when an investor claims profits
- `BuybackExecuted`: Emitted when buyback is completed
- `InvestorWhitelisted`: Emitted when an address is whitelisted
- `WorkflowStatusChanged`: Emitted when contract status changes
- `EmergencyWithdraw`: Emitted during emergency withdrawals

## Development Setup

### Prerequisites
- Node.js (v14 or later)
- npm or yarn
- Hardhat

### Installation
1. Clone the repository
2. Install dependencies:
```bash
npm install
```

### Environment Setup
Create a `.env` file with the following variables:
```
MUMBAI_RPC_URL=your_mumbai_rpc_url
PRIVATE_KEY=your_private_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key
COMPANY_WALLET=your_company_wallet_address
PLATFORM_WALLET=your_platform_wallet_address
EUR_USD_PRICE_FEED=your_eur_usd_price_feed_address
POL_USD_PRICE_FEED=your_pol_usd_price_feed_address
```

### Available Scripts
- `npm run compile`: Compile the contracts
- `npm run deploy:local`: Deploy and test locally on Hardhat Network
- `npm run deploy:mumbai`: Deploy to Mumbai Testnet
- `npm run verify:mumbai`: Verify contract on Polygonscan
- `npm run console`: Open Hardhat console
- `npm run node`: Start local Hardhat node

### Local Development
1. Start local node:
```bash
npm run node
```

2. Deploy and test locally:
```bash
npm run deploy:local
```

### Deployment
1. Compile contracts:
```bash
npm run compile
```

2. Deploy to Mumbai Testnet:
```bash
npm run deploy:mumbai
```

3. Verify contract:
```bash
npm run verify:mumbai
```

## Security Considerations
- Contract is pausable for emergency situations
- Reentrancy protection implemented
- Owner-only administrative functions
- Emergency withdrawal functions available
- Price feed validation
- Input validation for all critical functions

## License
MIT 