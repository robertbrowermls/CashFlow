import { buildHeaders } from "../../helpers";
import { RuntimeConfig } from "../../config";
import { PlacedOrder, PlaceOrderResponse } from "./placeOrderResponse";

export async function placeOrder(
    config: RuntimeConfig,
    accountId: string,
    symbol: string,
    type: string,
    price: number | null,
    optionSymbol: [string, string],
    side: [string, string],
    quantity: number,
    preview: boolean,
    tag?: string): Promise<PlaceOrderResponse> {
    const url = "{apiBaseUrl}/v1/accounts/{account_id}/orders"
        .replace('{apiBaseUrl}', config.API_BASE_URL)
        .replace('{account_id}', accountId);

    const params = new URLSearchParams();
    params.append('class', 'multileg');
    params.append('symbol', symbol);
    params.append(`type`, type);
    params.append(`duration`, 'gtc');
    if (price !== null) {
        params.append('price', (Math.trunc(price * 100) / 100).toFixed(2));
    }

    params.append(`option_symbol[0]`, optionSymbol[0]);
    params.append(`option_symbol[1]`, optionSymbol[1]);
    params.append(`side[0]`, side[0]);
    params.append(`side[1]`, side[1]);
    params.append('quantity[0]', quantity.toString());
    params.append('quantity[1]', quantity.toString());
    if (tag) {
        params.append('tag', encodeURIComponent(tag));
    }
    
    params.append('preview', preview.toString());

    const encoded = params.toString();
    const headers = { ...buildHeaders(config), ...{ 'Content-Type': 'application/x-www-form-urlencoded' } };
    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: encoded
    });

    if (!response.ok) {
        const errorBody = await new Response(response.body).text();
        throw new Error(`HTTP ${response.status} ${response.statusText} ${errorBody}`);
    }

    const data = (await response.json()) as PlaceOrderResponse;
    return data;
}