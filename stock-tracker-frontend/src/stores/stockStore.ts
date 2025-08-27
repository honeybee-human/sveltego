import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface StockQuote {
    c: number; // current price
    d: number; // change
    dp: number; // percent change
    h: number; // high
    l: number; // low
    o: number; // open
    pc: number; // previous close
    t: number; // timestamp
}

export interface StockCandles {
    c: number[]; // close prices
    h: number[]; // high prices
    l: number[]; // low prices
    o: number[]; // open prices
    s: string; // status
    t: number[]; // timestamps
    v: number[]; // volumes
}

export interface PricePoint {
    timestamp: number;
    price: number;
}

export interface CandlePoint {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface StockData {
    quote: StockQuote;
    candles: StockCandles;
    priceHistory: PricePoint[];
    candleHistory: CandlePoint[];
}

export interface SearchResult {
    description: string;
    displaySymbol: string;
    symbol: string;
    type: string;
}

const API_BASE = 'http://localhost:8080/api';

function createStockStore() {
    const { subscribe, set, update } = writable<Record<string, StockData>>({});

    return {
        subscribe,
        addStock: (symbol: string, data: StockData) => {
            update(stocks => ({
                ...stocks,
                [symbol]: data
            }));
        },
        removeStock: (symbol: string) => {
            update(stocks => {
                const newStocks = { ...stocks };
                delete newStocks[symbol];
                return newStocks;
            });
        },
        updateStock: (symbol: string, data: Partial<StockData>) => {
            update(stocks => {
                if (!stocks[symbol]) return stocks;
                return {
                    ...stocks,
                    [symbol]: {
                        ...stocks[symbol],
                        ...data
                    }
                };
            });
        },
        fetchStockData: async (symbol: string) => {
            if (!browser) return;

            try {
                const quoteResponse = await fetch(`${API_BASE}/quote/${symbol}`);
                if (!quoteResponse.ok) throw new Error(`Failed to fetch quote for ${symbol}`);
                
                const quote: StockQuote = await quoteResponse.json();
                
                const stockData: StockData = {
                    quote,
                    candles: {
                        c: [],
                        h: [],
                        l: [],
                        o: [],
                        s: 'ok',
                        t: [],
                        v: []
                    },
                    priceHistory: [],
                    candleHistory: []
                };

                update(stocks => ({
                    ...stocks,
                    [symbol]: stockData
                }));

                return stockData;
            } catch (error) {
                console.error(`Error fetching stock data for ${symbol}:`, error);
                throw error;
            }
        },
        searchStocks: async (query: string): Promise<SearchResult[]> => {
            if (!browser || !query.trim()) return [];

            try {
                const response = await fetch(`${API_BASE}/search/${encodeURIComponent(query)}`);
                if (!response.ok) throw new Error('Search failed');
                
                const data = await response.json();
                return data.result || [];
            } catch (error) {
                console.error('Search error:', error);
                return [];
            }
        },
        reset: () => set({})
    };
}

export const stocks = createStockStore(); 