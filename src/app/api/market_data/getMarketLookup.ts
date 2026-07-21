import { buildHeaders } from "../../helpers";
import { RuntimeConfig } from "../../config";
import { GetMarketLookupResponse, Security } from "./getMarketLookupResponse";

export async function getMarketLookup(config: RuntimeConfig, types: string[], exchanges: string[]): Promise<Security[]> {
    const url = "{apiBaseUrl}/v1/markets/lookup?types={types}&exchanges={exchanges}"
        .replace('{apiBaseUrl}', config.API_BASE_URL)
        .replace('{types}', encodeURIComponent(types.join(',')))
        .replace('{exchanges}', encodeURIComponent(exchanges.join(',')));

    const response = await fetch(url, { headers: buildHeaders(config) });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GetMarketLookupResponse;
    const securityList = Array.isArray(data.securities?.security) ? data.securities.security : [];
    return securityList;
}