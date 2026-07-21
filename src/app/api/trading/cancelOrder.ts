import { buildHeaders } from "../../helpers";
import { RuntimeConfig } from "../../config";
import { CanceledOrder, CancelOrderResponse } from "./cancelOrderResponse";


export async function cancelOrder(
    config: RuntimeConfig,
    accountId: string,
    orderId: number): Promise<CancelOrderResponse> {
    const url = "{apiBaseUrl}/v1/accounts/{accountId}/orders/{orderId}"
        .replace('{apiBaseUrl}', config.API_BASE_URL)
        .replace('{accountId}', accountId)
        .replace('{orderId}', orderId.toString());

    const headers = { ...buildHeaders(config), ...{ 'Content-Type': 'application/x-www-form-urlencoded' } };
    const response = await fetch(url, {
        method: 'DELETE',
        headers: headers
    });

    if (!response.ok) {
        const errorBody = await new Response(response.body).text();
        throw new Error(`HTTP ${response.status} ${response.statusText} ${errorBody}`);
    }

    const data = (await response.json()) as CancelOrderResponse;
    return data;
}