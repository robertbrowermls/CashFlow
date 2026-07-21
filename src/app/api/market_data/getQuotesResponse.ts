export interface Quote {
    symbol: string;
    description: string;
    exch: string;
    type: string;
    last: number;
    average_volume: number;
}

export interface GetQuotesResponse {
    quotes: {
        quote: Quote[];
    }
}