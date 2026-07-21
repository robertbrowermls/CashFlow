import { buildHeaders } from "../../helpers";
import { RuntimeConfig } from "../../config";
import { GetOptionsChainsResponse, Option } from "./getOptionsChainsResponse";

export async function getOptionsChains(config: RuntimeConfig, symbol: string, expiration: string): Promise<Option[]> {
  const url = "{apiBaseUrl}/v1/markets/options/chains?symbol={symbol}&expiration={expiration}"
    .replace('{apiBaseUrl}', config.API_BASE_URL)
    .replace('{symbol}', encodeURIComponent(symbol))
    .replace('{expiration}', encodeURIComponent(expiration));

  const response = await fetch(url, { headers: buildHeaders(config) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as GetOptionsChainsResponse;
  const optionList = Array.isArray(data.options?.option) ? data.options.option : [];
  return optionList;
}