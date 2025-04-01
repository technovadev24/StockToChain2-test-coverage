# StockToChain2 Smart Contract

## Vue d'ensemble
StockToChain2 est un smart contract ERC20 pour la vente de tokens avec un système de distribution de profits. Le contrat implémente :
- Une vente de tokens avec whitelist
- Un prix fixe en EUR (50 EUR par token)
- Une conversion automatique EUR vers POL via Chainlink
- Une distribution de profits sur 4 ans

## Fonctionnalités Principales

### Détails du Token
- Nom: StockToChain Token
- Symbole: STCT
- Supply Total: 84,000 tokens
- Prix: 50 EUR par token
- Décimales: 18

### Fonctionnalités Clés

#### 1. Système de Whitelist
- Seuls les adresses whitelistées peuvent participer à la vente
- Le propriétaire peut ajouter des adresses à la whitelist
- Vérification KYC requise avant whitelist

#### 2. Vente de Tokens
- Processus de vente contrôlé avec fonctions start/end
- Tokens achetables uniquement pendant la période active
- Conversion automatique EUR vers POL via Chainlink
- Remboursement automatique du POL en excès

#### 3. Distribution des Profits
- 60% des profits vont à la compagnie
- 30% des profits vont aux détenteurs de tokens
- 10% des profits vont à la plateforme
- Les investisseurs peuvent réclamer leur part après 4 ans

### Sécurité
- Fonctionnalité de pause pour les situations d'urgence
- Protection contre les attaques de réentrance
- Fonctions administratives réservées au propriétaire
- Fonctions de retrait d'urgence pour les tokens et le POL

### Price Feeds
- Intégration avec Chainlink pour :
  - Price feed EUR/USD
  - Price feed POL/USD
- Conversion automatique des prix entre EUR et POL

## Configuration Technique

### Prérequis
- Node.js v18 ou supérieur
- npm ou yarn
- Un wallet avec des fonds pour le déploiement

### Installation
1. Cloner le repository :
```bash
git clone <repository-url>
cd <repository-name>
```

2. Installer les dépendances :
```bash
npm install
```

3. Créer un fichier `.env` avec les variables suivantes :
```env
# Network URLs
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com
HARDHAT_RPC_URL=http://127.0.0.1:8545

# Dummy values for local development
PRIVATE_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
POLYGONSCAN_API_KEY=dummy_api_key

# Test addresses for local development (Hardhat test accounts)
COMPANY_WALLET=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
PLATFORM_WALLET=0x70997970C51812dc3A010C7d01b50e0d17dc79C8

# Mock Price Feed addresses for local development
EUR_USD_PRICE_FEED=0x5FbDB2315678afecb367f032d93F642f64180aa3
POL_USD_PRICE_FEED=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

## Déploiement

### Déploiement Local avec Ignition
1. Lancer le nœud Hardhat local :
```bash
npx hardhat node
```

2. Déployer les contrats avec Ignition :
```bash
npx hardhat ignition deploy ignition/modules/StockToChain2.js --network localhost
```

### Déploiement sur Mumbai Testnet
1. Configurer les variables d'environnement avec les vraies valeurs
2. Déployer sur Mumbai :
```bash
npx hardhat ignition deploy ignition/modules/StockToChain2.js --network mumbai
```

## Structure du Projet
```
├── contracts/
│   ├── StockToChain2.sol
│   └── mocks/
│       └── MockV3Aggregator.sol
├── ignition/
│   └── modules/
│       └── StockToChain2.js
├── scripts/
│   ├── deploy-local.js
│   └── deploy-mocks.js
├── test/
│   └── StockToChain2.test.js
├── .env
├── hardhat.config.js
└── package.json
```

## Workflow du Contrat

1. **Initialisation**
   - Déploiement du contrat
   - Configuration des price feeds Chainlink
   - Configuration des wallets (compagnie et plateforme)

2. **Whitelist**
   - Ajout des investisseurs à la whitelist
   - Seuls les investisseurs whitelistés peuvent acheter des tokens

3. **Vente**
   - Démarrage de la vente
   - Achat de tokens par les investisseurs whitelistés
   - Conversion automatique EUR vers POL

4. **Distribution des Profits**
   - Démarrage de la distribution
   - Période de 4 ans pour réclamer les profits
   - Distribution proportionnelle aux investissements

## Sécurité
- Protection contre les attaques de réentrance
- Système de pause pour la maintenance
- Contrôle d'accès via Ownable
- Validation des entrées utilisateur
- Gestion sécurisée des fonds

## Licence
MIT 