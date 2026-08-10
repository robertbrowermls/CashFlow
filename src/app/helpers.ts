import type { RuntimeConfig } from './config';
import { Option } from './api/market_data/getOptionsChainsResponse';
import { Trade } from './trade';
import Holidays from 'date-holidays';
import { logger } from './logger';

export function buildHeaders(config: RuntimeConfig): HeadersInit {
    const headers: HeadersInit = {
        Accept: 'application/json',
    };

    if (config.AUTHORIZATION) {
        headers.Authorization = config.AUTHORIZATION;
    }

    return headers;
}

export function chunkArray(arr: any[], size: number) {
    if (!Array.isArray(arr)) {
        throw new TypeError("First argument must be an array.");
    }
    if (typeof size !== "number" || size <= 0) {
        throw new RangeError("Chunk size must be a positive number.");
    }

    const result = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
}

export function findPricePairs<T extends Option>(
    options: T[],
    minSpread: number,
    maxSpread: number
): [T, T][] {
    if (!Array.isArray(options)) {
        throw new Error("options must be an array");
    }
    if (typeof minSpread !== "number" || typeof maxSpread !== "number") {
        throw new Error("minSpread and maxSpread must be numbers");
    }
    if (minSpread > maxSpread) {
        throw new Error("minSpread cannot be greater than maxSpread");
    }

    const pairs: [T, T][] = [];

    for (let i = 0; i < options.length; i++) {
        for (let j = 0; j < options.length; j++) {
            if (i === j) continue; // Skip pairing with itself

            const strikeDiff = options[i].strike - options[j].strike;
            const expirationA = new Date(options[i].expiration_date);
            const expirationB = new Date(options[j].expiration_date);
            const msPerDay = 1000 * 60 * 60 * 24;
            const daysToExpiration = Math.abs(Math.round((expirationA.getTime() - expirationB.getTime()) / msPerDay));

            if (strikeDiff >= minSpread && strikeDiff <= maxSpread &&
                expirationA.getTime() < expirationB.getTime() &&
                daysToExpiration === 7) {
                pairs.push([options[i], options[j]]);
            }
        }
    }

    return pairs;
}

export function findHighestRateOfReturn(arr: Trade[]): Trade | undefined {
    if (!Array.isArray(arr) || arr.length === 0) {
        return undefined; // Handle empty or invalid input
    }

    // Filter only positive values
    const positives = arr.filter(item => typeof item.ror === "number" && item.ror > 0);

    if (positives.length === 0) {
        return undefined; // No positive values found
    }

    // Reduce to find the largest positive value
    return positives.reduce((closest, current) =>
        current.ror > closest.ror ? current : closest
    );
}

export function daysFromToday(dateStr: string): number {
    // Validate input format using regex
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        throw new Error("Invalid date format. Expected yyyy-mm-dd.");
    }

    // Parse the date string safely
    const [year, month, day] = dateStr.split("-").map(Number);
    const targetDate = new Date(year, month - 1, day); // month is 0-based in JS

    if (isNaN(targetDate.getTime())) {
        throw new Error("Invalid date value.");
    }

    // Get today's date at midnight (no time component)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate difference in milliseconds
    const diffMs = targetDate.getTime() - today.getTime();

    // Convert milliseconds to days
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function toFixed(num: number, decimals: number): string {

    if (num === null) {
        return 'null';
    }

    if (num === undefined) {
        return 'undefined';
    }
    
    if (!Number.isFinite(num)) {
        return '∞';
    }

    if (decimals < 0) {
        throw new Error("Invalid input: decimals must be >= 0");
    }

    const factor = Math.pow(10, decimals);
    // Truncate toward zero
    const truncated = Math.trunc(num * factor) / factor;

    // Ensure fixed decimal places in string output
    return truncated.toFixed(decimals);
}

export function isMinutesExpired(a: Date, dateB: string, minutes: number): boolean {
    try {
        const b = new Date(dateB);

        // Validate that both dates are valid
        if (isNaN(a.getTime()) || isNaN(b.getTime())) {
            throw new Error("Invalid date string(s) provided.");
        }

        // Difference in milliseconds
        const diffMs = a.getTime() - b.getTime();

        // Convert to minutes
        const diffMinutes = diffMs / (1000 * 60);

        // Check if b is older than a by minutes or more
        return diffMinutes >= minutes;
    } catch (error) {
        console.error(error);
        return false;
    }
}

export function isWithinDays(dateObj: Date, targetDateStr: string, days: number): boolean {
    // Validate days
    if (!Number.isInteger(days) || days < 0) {
        throw new Error("Days must be a non-negative integer.");
    }

    // Validate date string format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)) {
        throw new Error("Date string must be in 'yyyy-mm-dd' format.");
    }

    // Parse target date safely (UTC to avoid timezone issues)
    const [year, month, day] = targetDateStr.split("-").map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day));

    if (isNaN(targetDate.getTime())) {
        throw new Error("Invalid target date.");
    }

    // Normalize both dates to midnight UTC for day-based comparison
    const givenDateUTC = Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate());

    const diffInMs = givenDateUTC - targetDate.getTime();
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    return Math.abs(diffInDays) <= days;
}

export function isUSFederalHoliday(dateInput: Date | string) {
    try {
        // Create a Holidays instance for the US
        const hd = new Holidays('US');

        // Normalize input to a Date object
        const date = (dateInput instanceof Date) ? dateInput : new Date(dateInput);

        if (isNaN(date.getTime())) {
            throw new Error('Invalid date format. Use YYYY-MM-DD or a valid Date object.');
        }

        // Get holiday info for the given date
        const holiday = hd.isHoliday(date);

        // holiday can be null or an array of holiday objects
        if (holiday) {
            // Filter for federal holidays only
            const federalHoliday = holiday.find(h => h.type === 'public');

            return federalHoliday ? federalHoliday.name : null;
        }

        return null;
    } catch (error) {
        console.error(error);
        return null;
    }
}

// Forbidden Characters
// The following characters are not allowed in Windows filenames:

// < (less than)
// > (greater than)
// : (colon)
// " (double quote)
// / (forward slash)
// ** (backslash)
// | (vertical bar or pipe)
// ? (question mark)
// * (asterisk)
export function sanitizeWindowsFilename(filename: string): string {
    // Regex to match all invalid Windows filename characters
    const invalidCharsRegex = /[\s<>:\"/\\|?*]/g; // Note: \s matches whitespace too

    // Replace all invalid characters with an underscore
    return filename.replace(invalidCharsRegex, '_');
}

export function daysBetweenDates(targetDateStr: string, isoDateStr: string): number {
    try {
        // Parse the "yyyy-mm-dd" date as UTC midnight
        const [year, month, day] = targetDateStr.split("-").map(Number);
        if (
            isNaN(year) || isNaN(month) || isNaN(day) ||
            month < 1 || month > 12 || day < 1 || day > 31
        ) {
            throw new Error("Invalid target date format");
        }
        const targetDate = new Date(Date.UTC(year, month - 1, day));

        // Parse the ISO date string
        const isoDate = new Date(isoDateStr);
        if (isNaN(isoDate.getTime())) {
            throw new Error("Invalid ISO date string");
        }

        // Normalize both dates to midnight UTC to avoid partial-day issues
        const targetUTC = Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate());
        const isoUTC = Date.UTC(isoDate.getUTCFullYear(), isoDate.getUTCMonth(), isoDate.getUTCDate());

        // Calculate difference in days
        const msPerDay = 1000 * 60 * 60 * 24;
        return Math.round((targetUTC - isoUTC) / msPerDay);
    } catch (err) {
        console.error((err as Error).message);
        return NaN;
    }
}

export function getDateTimeFormat(locale: string = "en-US", timeZone: string = "America/New_York"): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timeZone
    });
}

// Utility type to prefix keys of an object
export type PrefixKeys<T, P extends string> = {
  [K in keyof T as `${P}${Extract<K, string>}`]: T[K];
};

// Function to merge with prefixes
export function mergeTradesWithPrefixes(
  openTrade: Trade,
  closedTrade: Trade
): PrefixKeys<Trade, "open_"> & PrefixKeys<Trade, "closed_"> {
  const openPrefixed = Object.fromEntries(
    Object.entries(openTrade).map(([key, value]) => [`open_${key}`, value])
  ) as PrefixKeys<Trade, "open_">;

  const closedPrefixed = Object.fromEntries(
    Object.entries(closedTrade).map(([key, value]) => [`closed_${key}`, value])
  ) as PrefixKeys<Trade, "closed_">;

  return { ...openPrefixed, ...closedPrefixed };
}

export interface CompoundingRow {
    accountProfit: number;
    lotSize: number;
    nextIncrease: number | null;
}

export function getCompoundingFactor(delta: number, accountProfit: number): number {
    if (typeof delta !== "number" || Number.isNaN(delta) || delta <= 0) {
        throw new Error("Delta must be a positive number.");
    }
    if (typeof accountProfit !== "number" || Number.isNaN(accountProfit)) {
        throw new Error("Account profit must be a number.");
    }

    if (accountProfit <= 0) {
        return 1;
    }

    const rows: CompoundingRow[] = [{ accountProfit: 0, lotSize: 1, nextIncrease: null }];

    let currentAccountProfit = 0;
    let currentLotSize = 1;
    let nextIncrease = delta;
    let bestLotSize = 1;

    while (currentAccountProfit < accountProfit) {
        bestLotSize = currentLotSize;

        const nextAccountProfit = currentAccountProfit + nextIncrease;
        const nextLotSize = currentLotSize + 1;

        rows.push({
            accountProfit: nextAccountProfit,
            lotSize: nextLotSize,
            nextIncrease: delta * nextLotSize,
        });

        currentAccountProfit = nextAccountProfit;
        currentLotSize = nextLotSize;
        nextIncrease = delta * currentLotSize;
    }

    // logger.debug(`compounding table = ${JSON.stringify(rows)}`);

    return bestLotSize;
}

export function numTradingDaysBetweenDates(startDateStr: string, endDateStr: string): number {
    try {
        const startDate = new Date(`${startDateStr}T00:00:00Z`);
        const endDate = new Date(`${endDateStr}T00:00:00Z`);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error("Invalid date string(s) provided.");
        }

        const startUTC = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
        const endUTC = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());

        if (endUTC < startUTC) {
            return 0;
        }

        const msPerDay = 1000 * 60 * 60 * 24;
        const totalDays = Math.max(0, Math.round((endUTC - startUTC) / msPerDay));
        let tradingDays = 0;

        for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
            const currentDate = new Date(startUTC + (dayOffset * msPerDay));
            const dayOfWeek = currentDate.getUTCDay();

            if (dayOfWeek === 0 || dayOfWeek === 6) {
                continue;
            }

            if (isUSFederalHoliday(currentDate)) {
                continue;
            }

            tradingDays++;
        }

        return tradingDays;
    } catch (err) {
        console.error((err as Error).message);
        return NaN;
    }
}
