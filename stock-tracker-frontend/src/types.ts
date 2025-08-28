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

export interface SearchResponse {
	count: number;
	result: SearchResult[];
}

export type ApexCharts = any;
export type ApexOptions = any;
export type ChartType = 'line' | 'candlestick' | 'area' | 'volume';
