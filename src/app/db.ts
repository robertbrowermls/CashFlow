import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join } from 'path';
import fs from 'fs';
import { ClosedTrade, Trade } from './trade';
import { Order } from './order';

// Define the shape of the database
type Data = {
    tradesBySymbol: {[symbol: string]: Trade[]};
    trades: Trade[];
    closedTrades?: ClosedTrade[];
    orders: Order[];
};

export class DB {
    private static _instance: Low<Data> | null = null;

    // Private constructor to prevent direct instantiation
    private constructor() { }

    // Static async method instead of async getter
    public static async getInstance(): Promise<Low<Data>> {
        if (!DB._instance) {
            const cwd = process.cwd();
            const filePath = join(cwd, `db.json`)

            // Ensure file exists with defaults
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(
                    filePath,
                    JSON.stringify({ tradesBySymbol: {}, trades: [], closedTrades: [], orders: [] }, null, 2)
                );
            }

            const adapter = new JSONFile<Data>(filePath);
            DB._instance = new Low<Data>(adapter, { tradesBySymbol: {}, trades: [], closedTrades: [], orders: [] });

            await DB._instance.read();
            const data = DB._instance.data ?? { tradesBySymbol: {}, trades: [], closedTrades: [], orders: [] };
            DB._instance.data = {
                tradesBySymbol: data.tradesBySymbol ?? {},
                trades: data.trades ?? [],
                closedTrades: data.closedTrades ?? [],
                orders: data.orders ?? []
            };
        }
        return DB._instance;
    }
}