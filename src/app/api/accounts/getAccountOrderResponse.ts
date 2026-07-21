import { AccountOrder } from "./getAccountOrdersResponse";


export interface AccountOrder2 extends AccountOrder {
    last_fill_price: number;
    last_fill_quantity: number;
    remaining_quantity: number;
}


export interface GetAccountOrderResponse {
    order: AccountOrder2;
}