import { browser } from '$app/environment';
import { appStore } from './appStore';
import { stockStore } from './stockStore';
import type { StockData } from '../types';

function createStorageStore() {
    const saveStockData = (data: Record<string, StockData>) => {
        if (!browser) return;
        
        try {
            const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
            const dataToSave: Record<string, StockData> = {};
            
            Object.keys(data).forEach(symbol => {
                const stockData = data[symbol];
                dataToSave[symbol] = {
                    ...stockData,
                    priceHistory: stockData.priceHistory.filter(p => p.timestamp > dayAgo),
                    candleHistory: stockData.candleHistory.filter(c => c.timestamp > dayAgo)
                };
            });
            
            localStorage.setItem('stockTrackerData', JSON.stringify(dataToSave));
        } catch (error) {
            console.error('Failed to save stock data:', error);
        }
    };
    
    const loadStockData = (): Record<string, StockData> => {
        if (!browser) return {};
        
        try {
            const stored = localStorage.getItem('stockTrackerData');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('Failed to load stock data:', error);
            return {};
        }
    };
    
    const saveFollowedStocks = (stocks: string[]) => {
        if (!browser) return;
        localStorage.setItem('followedStocks', JSON.stringify(stocks));
    };
    
    const loadFollowedStocks = (): string[] => {
        if (!browser) return ['AAPL', 'GOOGL'];
        
        try {
            const stored = localStorage.getItem('followedStocks');
            return stored ? JSON.parse(stored) : ['AAPL', 'GOOGL'];
        } catch (error) {
            console.error('Failed to load followed stocks:', error);
            return ['AAPL', 'GOOGL'];
        }
    };

    const saveDataToStorage = () => {
        if (!browser) return;
        
        let currentStockData: Record<string, StockData> = {};
        let currentFollowedStocks: string[] = [];
        
        stockStore.stockData.subscribe(value => currentStockData = value)();
        appStore.followedStocks.subscribe(value => currentFollowedStocks = value)();
        
        saveStockData(currentStockData);
        saveFollowedStocks(currentFollowedStocks);
    };

    const loadStoredData = () => {
        if (!browser) return;
        
        const stockData = loadStockData();
        const followedStocks = loadFollowedStocks();
        
        stockStore.setStockData(stockData);
        appStore.setFollowedStocks(followedStocks);
    };

    const clearStoredData = () => {
        if (!browser) return;
        
        try {
            localStorage.removeItem('stockTrackerData');
            localStorage.removeItem('followedStocks');
        } catch (error) {
            console.error('Failed to clear stored data:', error);
        }
    };
    
    return {
        saveStockData,
        loadStockData,
        saveFollowedStocks,
        loadFollowedStocks,
        saveDataToStorage,
        loadStoredData,
        clearStoredData
    };
}

export const storageStore = createStorageStore();