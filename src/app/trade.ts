export interface Trade {
  shortSymbol: string;
  longSymbol: string;
  underlying: string;
  price: number | null;
  expiration: string;
  shortStrike: number;
  longStrike: number;
  shortBid: number;
  shortAsk: number;
  longBid: number;
  longAsk: number;
  priceAdjustment: number;
  shortPrice: number;
  longPrice: number;
  credit: number;
  risk: number;
  ror: number;
  annualizedReturn: number;
  timestamp: string;
}

export interface ClosedTrade {
  open_shortSymbol: string;
  open_longSymbol: string;
  open_underlying: string;
  open_price: number | null;
  open_expiration: string;
  open_shortStrike: number;
  open_longStrike: number;
  open_shortBid: number;
  open_shortAsk: number;
  open_longBid: number;
  open_longAsk: number;
  open_priceAdjustment: number;
  open_shortPrice: number;
  open_longPrice: number;
  open_credit: number;
  open_risk: number;
  open_ror: number;
  open_annualizedReturn: number;
  open_timestamp: string;
  closed_shortSymbol: string;
  closed_longSymbol: string;
  closed_underlying: string;
  closed_price: number | null;
  closed_expiration: string;
  closed_shortStrike: number;
  closed_longStrike: number;
  closed_shortBid: number;
  closed_shortAsk: number;
  closed_longBid: number;
  closed_longAsk: number;
  closed_priceAdjustment: number;
  closed_shortPrice: number;
  closed_longPrice: number;
  closed_credit: number;
  closed_risk: number;
  closed_ror: number;
  closed_annualizedReturn: number;
  closed_timestamp: string;
}

export interface TradesForSymbol {
  symbol: string;
  trades: Trade[];
}

