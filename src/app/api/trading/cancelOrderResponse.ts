export type CanceledOrderStatus = 'ok' | 'pending_cancel';


export interface CanceledOrder {
    id: number;
    status: string;
}

export interface CanceledOrderErrors {
    error: string;
}

export interface CancelOrderResponse {
    order?: CanceledOrder;
    errors?: CanceledOrderErrors;
}