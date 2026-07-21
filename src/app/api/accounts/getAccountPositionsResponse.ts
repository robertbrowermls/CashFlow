export interface AccountPosition {
    cost_basis: string;
    date_acquired: string;
    id: number;
    quantity: number;
    symbol: string;
}

export interface AccountPositions {
    position: AccountPosition[];
}

export interface GetAccountPositionsResponse {
    positions: AccountPositions;
}