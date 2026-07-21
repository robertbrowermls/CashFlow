export interface PlacedOrder {
    id: number;
    status: string;
    partner_id: string;
};

export interface PlacedOrderErrors {
    error: string;
}

export interface PlaceOrderResponse {
    order?: PlacedOrder;
    errors?: PlacedOrderErrors;
}