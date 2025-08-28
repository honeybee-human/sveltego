import { browser } from '$app/environment';
import type { StockData, StockQuote, StockCandles, PricePoint, CandlePoint, SearchResponse } from '../types';

const API_BASE: string = 'http://localhost:8080/api';
const MAX_HISTORY_POINTS = 500;
const CANDLE_INTERVAL_MS = 60000;

export class DataLoader {
	private currentCandleData: Record<string, CandlePoint> = {};

	async loadStockData(
		followedStocks: string[],
		currentStockData: Record<string, StockData>
	): Promise<Record<string, StockData>> {
		if (!browser) return currentStockData;
		
		const currentTime = Date.now();
		const updatedStockData = { ...currentStockData };
		
		for (const symbol of followedStocks) {
			try {
				const quoteResponse = await fetch(`${API_BASE}/quote/${symbol}`);
				
				if (!quoteResponse.ok) {
					throw new Error(`HTTP error! status: ${quoteResponse.status}`);
				}

				const quote: StockQuote = await quoteResponse.json();
				
				const candlestickData = await this.fetchCandlestickData(symbol);
				
				const existingData = updatedStockData[symbol] || {
					quote: quote,
					candles: { c: [], h: [], l: [], o: [], s: 'ok', t: [], v: [] },
					priceHistory: [],
					candleHistory: []
				};

				const basePrice = quote.c;
				const currentPrice = basePrice;

				const candleHistory = this.convertCandlesToHistory(candlestickData);

				this.updateCandleData(symbol, currentTime, currentPrice, existingData);

				const newPricePoint: PricePoint = {
					timestamp: currentTime,
					price: currentPrice
				};

				const updatedHistory = [...existingData.priceHistory, newPricePoint]
					.slice(-MAX_HISTORY_POINTS);

				updatedStockData[symbol] = {
					quote: { ...quote, c: currentPrice },
					candles: candlestickData,
					priceHistory: updatedHistory,
					candleHistory: candleHistory.length > 0 ? candleHistory : existingData.candleHistory
				};

			} catch (error) {
				console.error(`Failed to load data for ${symbol}:`, error);
			}
		}
		
		return updatedStockData;
	}

	async fetchCandlestickData(symbol: string): Promise<StockCandles> {
		try {
			const candlesResponse = await fetch(`${API_BASE}/candles/${symbol}`);
			
			if (!candlesResponse.ok) {
				console.warn(`Failed to fetch candles for ${symbol}, status: ${candlesResponse.status}`);
				return { c: [], h: [], l: [], o: [], s: 'no_data', t: [], v: [] };
			}

			const candlesData: StockCandles = await candlesResponse.json();
			return candlesData;
		} catch (error) {
			console.error(`Error fetching candlestick data for ${symbol}:`, error);
			return { c: [], h: [], l: [], o: [], s: 'no_data', t: [], v: [] };
		}
	}

	private convertCandlesToHistory(candles: StockCandles): CandlePoint[] {
		if (!candles.t || candles.t.length === 0) {
			return [];
		}

		const candleHistory: CandlePoint[] = [];
		
		for (let i = 0; i < candles.t.length; i++) {
			candleHistory.push({
				timestamp: candles.t[i] * 1000,
				open: candles.o[i] || 0,
				high: candles.h[i] || 0,
				low: candles.l[i] || 0,
				close: candles.c[i] || 0,
				volume: candles.v[i] || 0
			});
		}

		return candleHistory;
	}

	private updateCandleData(symbol: string, timestamp: number, price: number, existingData: StockData): void {
		const candleStartTime = Math.floor(timestamp / CANDLE_INTERVAL_MS) * CANDLE_INTERVAL_MS;
		
		let currentCandle = this.currentCandleData[symbol];
		
		if (!currentCandle || currentCandle.timestamp !== candleStartTime) {
			currentCandle = {
				timestamp: candleStartTime,
				open: price,
				high: price,
				low: price,
				close: price,
				volume: Math.floor(Math.random() * 1000000)
			};
			this.currentCandleData[symbol] = currentCandle;
		} else {
			currentCandle.high = Math.max(currentCandle.high, price);
			currentCandle.low = Math.min(currentCandle.low, price);
			currentCandle.close = price;
		}

		if (timestamp - candleStartTime >= CANDLE_INTERVAL_MS - 5000) {
			const candleHistory = [...existingData.candleHistory];
			
			const existingIndex = candleHistory.findIndex(c => c.timestamp === candleStartTime);
			if (existingIndex >= 0) {
				candleHistory[existingIndex] = { ...currentCandle };
			} else {
				candleHistory.push({ ...currentCandle });
			}
			
			existingData.candleHistory = candleHistory.slice(-MAX_HISTORY_POINTS);
		}
	}

	async searchStocks(searchQuery: string): Promise<SearchResponse> {
		if (!browser || !searchQuery.trim()) {
			return { count:0, result: [] };
		}

		try {
			const response = await fetch(`${API_BASE}/search/${encodeURIComponent(searchQuery)}`);
			
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data: SearchResponse = await response.json();
			return data;
		} catch (error) {
			console.error('Search failed:', error);
			return { count:0, result: [] };
		}
	}

	clearCandleData(): void {
		this.currentCandleData = {};
	}
}