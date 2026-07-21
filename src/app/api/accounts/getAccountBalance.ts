import { buildHeaders } from "../../helpers";
import { RuntimeConfig } from "../../config";
import { Balances, GetAccountBalanceResponse } from "./getAccountBalanceResponse";

export async function getAccountBalance(config: RuntimeConfig, accountId: string): Promise<Balances> {
  const url = "{apiBaseUrl}/v1/accounts/{accountId}/balances"
    .replace('{apiBaseUrl}', config.API_BASE_URL)
    .replace('{accountId}', encodeURIComponent(accountId));

  const response = await fetch(url, { headers: buildHeaders(config) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as GetAccountBalanceResponse;
  return data.balances;
}