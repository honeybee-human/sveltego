import { writable } from 'svelte/store';
import type { SearchResult } from '../types';

function createAppStore() {
    const loading = writable<boolean>(false);
    const lastUpdateTime = writable<string>('');
    const searchQuery = writable<string>('');
    const searchResults = writable<SearchResult[]>([]);
    const followedStocks = writable<string[]>(['AAPL', 'GOOGL']);
    
    return {
        loading,
        lastUpdateTime,
        searchQuery,
        searchResults,
        followedStocks,
        setLoading: (isLoading: boolean) => loading.set(isLoading),
        setLastUpdateTime: (time: string) => lastUpdateTime.set(time),
        updateLastUpdateTime: () => lastUpdateTime.set(new Date().toLocaleTimeString()),
        setSearchQuery: (query: string) => searchQuery.set(query),
        setSearchResults: (results: SearchResult[]) => searchResults.set(results),
        setFollowedStocks: (stocks: string[]) => followedStocks.set(stocks),
        addFollowedStock: (symbol: string) => {
            followedStocks.update(stocks => 
                stocks.includes(symbol) ? stocks : [...stocks, symbol]
            );
        },
        removeFollowedStock: (symbol: string) => {
            followedStocks.update(stocks => stocks.filter(s => s !== symbol));
        }
    };
}

export const appStore = createAppStore();