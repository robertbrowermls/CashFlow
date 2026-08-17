import { buildHeaders, chunkArray } from "../../helpers";
import { RuntimeConfig } from "../../config";
import { GetQuotesResponse, Quote } from "./getQuotesResponse";

export async function getQuotes(config: RuntimeConfig, symbols: string[]): Promise<Quote[]> {
    let quotes: Quote[] = [];

    // There are potentially too many symbols for one request so this must be done in chunks.
    const chunks = chunkArray(symbols, config.GET_QUOTES_API_CHUNK_SIZE);
    for (const chunkOfSymbols of chunks) {
        const url = "{apiBaseUrl}/v1/markets/quotes?symbols={symbols}"
        .replace('{apiBaseUrl}', config.API_BASE_URL)    
        .replace('{symbols}', encodeURIComponent(chunkOfSymbols.join(",")));

        const response = await fetch(url, { headers: buildHeaders(config) });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as GetQuotesResponse;
        const chunkOfQuotes = Array.isArray(data.quotes?.quote) ? data.quotes.quote : [data.quotes?.quote];
        quotes = [...quotes, ...chunkOfQuotes];
    }

    return quotes;
}