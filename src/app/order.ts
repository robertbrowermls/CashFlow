import { PlacedOrder } from "./api/trading/placeOrderResponse";
import { Trade } from "./trade";

export interface Order extends PlacedOrder, Trade {
  
}