export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'debit' | 'credit' | 'even';
export type OrderSide = 'buy' | 'buy_to_cover' | 'sell' | 'sell_short' | 'buy_to_open' | 'buy_to_close' | 'sell_to_open' | 'sell_to_close';
export type OrderStatus = 'pending' | 'open' | 'partially_filled' | 'filled' | 'expired' | 'canceled' | 'rejected' | 'pending_cancel';
export type OrderDuration = 'day' | 'gtc' | 'pre' | 'post';
export type OrderClass = 'equity' | 'option' | 'multileg' | 'combo';

export interface AccountOrder {
    id: number,
    type: OrderType,
    symbol: string,
    side: OrderSide,
    quantity: number,
    status: OrderStatus,
    duration: OrderDuration,
    avg_fill_price: number,
    exec_quantity: number,
    create_date: string; // "2015-04-01T15:25:47.000Z",
    transaction_date: string; // "2015-04-01T15:25:47.000Z",
    class: OrderClass
}

export interface Orders {
    order: AccountOrder[]
}

export interface GetAccountOrdersResponse {
    orders: Orders;
}