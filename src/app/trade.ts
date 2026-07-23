export interface Trade {
  shortSymbol: string;
  longSymbol: string;
  underlying: string;
  price: number | null;
  shortExpiration: string;
  longExpiration: string;
  shortStrike: number;
  longStrike: number;
  shortBid: number;
  shortAsk: number;
  longBid: number;
  longAsk: number;
  priceAdjustment: number;
  shortPrice: number;
  longPrice: number;
  debit: number;
  gain: number;
  ror: number;
  timestamp: string;
}

export interface ClosedTrade {
  open_shortSymbol: string;
  open_longSymbol: string;
  open_underlying: string;
  open_price: number | null;
  open_shortExpiration: string;
  open_longExpiration: string;
  open_shortStrike: number;
  open_longStrike: number;
  open_shortBid: number;
  open_shortAsk: number;
  open_longBid: number;
  open_longAsk: number;
  open_priceAdjustment: number;
  open_shortPrice: number;
  open_longPrice: number;
  open_debit: number;
  open_gain: number;
  open_ror: number;
  open_timestamp: string;
  closed_shortSymbol: string;
  closed_longSymbol: string;
  closed_underlying: string;
  closed_price: number | null;
  closed_shortExpiration: string;
  closed_longExpiration: string;
  closed_shortStrike: number;
  closed_longStrike: number;
  closed_shortBid: number;
  closed_shortAsk: number;
  closed_longBid: number;
  closed_longAsk: number;
  closed_priceAdjustment: number;
  closed_shortPrice: number;
  closed_longPrice: number;
  closed_debit: number;
  closed_gain: number;
  closed_ror: number;
  closed_timestamp: string;
}

export interface TradesForSymbol {
  symbol: string;
  trades: Trade[];
}

