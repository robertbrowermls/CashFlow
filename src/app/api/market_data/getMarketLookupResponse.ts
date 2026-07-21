export interface Security {
    symbol: string;
    underlying: string;
    description: string;
    exchange: string;
    type: string;
}

export interface GetMarketLookupResponse {
    securities: {
        security: Security[];
    }
}