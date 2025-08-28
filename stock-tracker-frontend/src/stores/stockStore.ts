import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { StockData, StockQuote, SearchResult } from '../types';


const API_BASE = 'http://localhost:8080/api';

function createStockStore() {
    const { subscribe, set, update } = writable<Record<string, StockData>>({});

    return {
        subscribe,
        stockData: { subscribe },
        setStockData: (data: Record<string, StockData>) => set(data),
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
        clearHistory: () => {
            update(stocks => {
                const clearedStocks: Record<string, StockData> = {};
                Object.keys(stocks).forEach(symbol => {
                    clearedStocks[symbol] = {
                        ...stocks[symbol],
                        priceHistory: [],
                        candleHistory: []
                    };
                });
                return clearedStocks;
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

export const stockStore = createStockStore();