export interface Balances {
  "account_number": string;
  "total_cash": number;
  "margin": {
    "option_buying_power": number;
  "stock_buying_power": number;
  }
  
}
export interface GetAccountBalanceResponse {
  balances: Balances;
}