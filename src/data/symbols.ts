export interface SymbolMetadata {
  symbol: string;
  name: string;
  sector: string;
  initialPrice: number;
}

export const TARGET_SYMBOLS_METADATA: SymbolMetadata[] = [
  { symbol: "BTCUSDT", name: "Bitcoin", sector: "MegaCap/StoreOfValue", initialPrice: 64250.0 },
  { symbol: "ETHUSDT", name: "Ethereum", sector: "MegaCap/SmartContracts", initialPrice: 3480.0 },
  { symbol: "SOLUSDT", name: "Solana", sector: "L1_HighPerformance", initialPrice: 148.5 },
  { symbol: "BNBUSDT", name: "BNB", sector: "ExchangeToken/BSC", initialPrice: 575.0 },
  { symbol: "XRPUSDT", name: "Ripple", sector: "Payment_CrossBorder", initialPrice: 0.585 },
  { symbol: "ADAUSDT", name: "Cardano", sector: "L1_Alternative", initialPrice: 0.355 },
  { symbol: "AVAXUSDT", name: "Avalanche", sector: "L1_Alternative", initialPrice: 28.2 },
  { symbol: "SUIUSDT", name: "Sui", sector: "L1_HighPerformance", initialPrice: 1.62 },
  { symbol: "DOTUSDT", name: "Polkadot", sector: "L1_Interoperability", initialPrice: 4.45 },
  { symbol: "LINKUSDT", name: "Chainlink", sector: "DeFi_Oracle", initialPrice: 11.2 },
  { symbol: "NEARUSDT", name: "NEAR Protocol", sector: "L1_AI_Sharding", initialPrice: 4.85 },
  { symbol: "FETUSDT", name: "Artificial Superintelligence", sector: "AI_Agents", initialPrice: 1.38 },
  { symbol: "RENDERUSDT", name: "Render", sector: "AI_GPU_Compute", initialPrice: 6.1 },
  { symbol: "TAOUSDT", name: "Bittensor", sector: "AI_Decentralized_Intelligence", initialPrice: 535.0 },
  { symbol: "OPUSDT", name: "Optimism", sector: "Ethereum_L2", initialPrice: 1.55 },
  { symbol: "ARBUSDT", name: "Arbitrum", sector: "Ethereum_L2", initialPrice: 0.54 },
  { symbol: "APTUSDT", name: "Aptos", sector: "L1_HighPerformance", initialPrice: 8.2 },
  { symbol: "DOGEUSDT", name: "Dogecoin", sector: "Meme_OG", initialPrice: 0.108 },
  { symbol: "SHIBUSDT", name: "Shiba Inu", sector: "Meme_Ecosystem", initialPrice: 0.0000145 },
  { symbol: "PEPEUSDT", name: "Pepe", sector: "Meme_Modern", initialPrice: 0.0000098 },
  { symbol: "WIFUSDT", name: "dogwifhat", sector: "Meme_Solana", initialPrice: 2.15 },
  { symbol: "BONKUSDT", name: "Bonk", sector: "Meme_Solana", initialPrice: 0.0000192 },
  { symbol: "ONDOUSDT", name: "Ondo Finance", sector: "RWA_DeFi", initialPrice: 0.74 },
  { symbol: "JUPUSDT", name: "Jupiter", sector: "Solana_DeFi", initialPrice: 0.88 },
  { symbol: "STXUSDT", name: "Stacks", sector: "Bitcoin_L2", initialPrice: 1.82 },
];
