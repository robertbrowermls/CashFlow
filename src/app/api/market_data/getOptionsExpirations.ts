import { buildHeaders } from "../../helpers";
import { RuntimeConfig } from "../../config";
import { GetOptionsExpirationsResponse } from "./getOptionsExpirationsResponse";

export async function getOptionsExpirations(config: RuntimeConfig, symbol: string): Promise<string[]> {
  const url = "{apiBaseUrl}/v1/markets/options/expirations?symbol={symbol}&includeAllRoots=false"
    .replace('{apiBaseUrl}', config.API_BASE_URL)
    .replace('{symbol}', encodeURIComponent(symbol));

  const response = await fetch(url, { headers: buildHeaders(config) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as GetOptionsExpirationsResponse;
  const expirationList = Array.isArray(data.expirations?.date) ? data.expirations.date : [];
  return expirationList;
}