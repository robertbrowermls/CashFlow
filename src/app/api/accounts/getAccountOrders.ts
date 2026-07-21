import { buildHeaders } from "../../helpers";
import { RuntimeConfig } from "../../config";
import { GetAccountOrdersResponse, AccountOrder } from "./getAccountOrdersResponse";

export async function getAccountOrders(config: RuntimeConfig, accountId: string): Promise<AccountOrder[]> {
  const url = "{apiBaseUrl}/v1/accounts/{accountId}/orders"
    .replace('{apiBaseUrl}', config.API_BASE_URL)
    .replace('{accountId}', encodeURIComponent(accountId));

  const response = await fetch(url, { headers: buildHeaders(config) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  
  const json = (await response.json());
  if (json.orders === null || json.orders === 'null') {
    return [];
  }
  
  const data = json as GetAccountOrdersResponse;
  return Array.isArray(data.orders.order) ? data.orders.order : [data.orders.order];
}