import { buildHeaders } from "../../helpers";
import { RuntimeConfig } from "../../config";
import { AccountOrder2, GetAccountOrderResponse } from "./getAccountOrderResponse";

export async function getAccountOrder(config: RuntimeConfig, accountId: string, orderId: number): Promise<AccountOrder2> {
  const url = "{apiBaseUrl}/v1/accounts/{accountId}/orders/{orderId}"
    .replace('{apiBaseUrl}', config.API_BASE_URL)
    .replace('{accountId}', encodeURIComponent(accountId))
    .replace('{orderId}', encodeURIComponent(orderId));

  const response = await fetch(url, { headers: buildHeaders(config) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as GetAccountOrderResponse;
  return data.order;
}