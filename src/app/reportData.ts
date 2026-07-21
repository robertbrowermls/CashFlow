import { Balances } from "./api/accounts/getAccountBalanceResponse";
import { AccountOrder } from "./api/accounts/getAccountOrdersResponse";
import { AccountPosition } from "./api/accounts/getAccountPositionsResponse";
import { Security } from "./api/market_data/getMarketLookupResponse";
import { Quote } from "./api/market_data/getQuotesResponse";
import { UserProfile } from "./api/user/getUserProfileResponse";
import { Option } from "./api/market_data/getOptionsChainsResponse";
import { Trade, TradesForSymbol } from "./trade";

export interface ReportData {
  appName?: string;
  title?: string;
  userProfile?: UserProfile;
  accountBalance?: Balances;
  minCashBalance?: number;
  optionsExpirations?: string[];
  orders?: AccountOrder[];
  positions?: AccountPosition[];
  marketLookup?: Security[];
  quotes?: Quote[];
  optionsChains?: Option[];
  trades?: Trade[];
  closedTrades?: Record<string, any>[];
  tradesBySymbol?: TradesForSymbol[]
}