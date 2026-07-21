import { buildHeaders } from "../../helpers";
import { RuntimeConfig } from "../../config";
import { GetAccountPositionsResponse, AccountPosition } from "./getAccountPositionsResponse";

export async function getAccountPositions(config: RuntimeConfig, accountId: string): Promise<AccountPosition[]> {
  const url = "{apiBaseUrl}/v1/accounts/{accountId}/positions"
    .replace('{apiBaseUrl}', config.API_BASE_URL)
    .replace('{accountId}', encodeURIComponent(accountId));

  const response = await fetch(url, { headers: buildHeaders(config) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as GetAccountPositionsResponse;
  return data.positions.position;
}