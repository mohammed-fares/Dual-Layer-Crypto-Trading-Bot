export interface CryptoAsset {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  prevPrice: number;
  change1m: number;
  change24h: number;
  volume24h: number;
  isLeader: boolean;
  lastUpdated: number;
  priceHistory: number[];
}

export interface Position {
  id: string;
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  sizeUsd: number;
  coinsAmount: number;
  entryTime: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  triggerLeader: string;
  correlation: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPct: number;
}

export interface ClosedTrade {
  id: string;
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  sizeUsd: number;
  returnPct: number;
  pnlUsd: number;
  exitTime: number;
  reason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL';
  walletBalanceAfter: number;
  triggerLeader: string;
}

export interface ContextGraphNode {
  symbol: string;
  sector: string;
  isLeader: boolean;
  momentum1m: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface ContextGraphEdge {
  source: string;
  target: string;
  correlation: number;
}

export interface TerminalLog {
  id: string;
  timestamp: string;
  type: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'SNIPER' | 'BRAIN' | 'TRADE';
  message: string;
}
