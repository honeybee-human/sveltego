import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { StockData, SearchResult, CandlePoint, StockQuote, PricePoint, SearchResponse } from '../types';
 type ChartType = 'line' | 'candlestick' | 'area' | 'volume';
type ApexCharts = any;
type ApexOptions = any;

const API_BASE: string = 'http://localhost:8080/api';
const MAX_HISTORY_POINTS = 500;
const CANDLE_INTERVAL_MS = 60000;

export function createStockTracker() {
	// Writable stores for reactive state
	const followedStocks = writable<string[]>(['AAPL', 'GOOGL']);
	const stockData = writable<Record<string, StockData>>({});
	const searchQuery = writable<string>('');
	const searchResults = writable<SearchResult[]>([]);
	const loading = writable<boolean>(false);
	const lastUpdateTime = writable<string>('');
	const chartType = writable<ChartType>('area');
	const selectedTimeframe = writable<number>(30);

	// Internal state
	let chart: ApexCharts;
	let ApexChartsClass: any = null;
	let intervalId: number | null = null;
	let currentCandleData: Record<string, CandlePoint> = {};
	let chartContainer: HTMLElement;

	// Current values for internal use
	let currentFollowedStocks: string[] = ['AAPL', 'GOOGL'];
	let currentStockData: Record<string, StockData> = {};
	let currentSearchQuery: string = '';
	let currentChartType: ChartType = 'area';
	let currentSelectedTimeframe: number = 30;

	// Subscribe to store changes to keep internal state in sync
	followedStocks.subscribe(value => currentFollowedStocks = value);
	stockData.subscribe(value => currentStockData = value);
	searchQuery.subscribe(value => currentSearchQuery = value);
	chartType.subscribe(value => currentChartType = value);
	selectedTimeframe.subscribe(value => currentSelectedTimeframe = value);

	async function initialize(container: HTMLElement) {
		if (!browser) return;
		
		chartContainer = container;
		
		const ApexChartsModule = await import('apexcharts');
		ApexChartsClass = ApexChartsModule.default;
		
		loadStoredData();
		initChart();
		await loadStockData();
		
		intervalId = setInterval(loadStockData, 15000);
	}

	function cleanup() {
		if (intervalId) {
			clearInterval(intervalId);
		}
		if (chart) {
			chart.destroy();
		}
		// Only save data if we're in the browser
		if (browser) {
			saveDataToStorage();
		}
	}

	function initChart(): void {
		if (!browser || !chartContainer || !ApexChartsClass) return;

		const options: ApexOptions = getChartOptions();
		chart = new ApexChartsClass(chartContainer, options);
		chart.render();
		
		updateChart();
	}

	function getChartOptions(): ApexOptions {
		const baseOptions = {
			chart: {
				type: currentChartType === 'candlestick' ? 'candlestick' : currentChartType,
				height: 500,
				zoom: { 
					enabled: true,
					type: 'x',
					autoScaleYaxis: true
				},
				toolbar: {
					show: true,
					tools: {
						zoom: true,
						zoomin: true,
						zoomout: true,
						pan: true,
						reset: true,
						selection: true,
						download: true
					}
				},
				animations: {
					enabled: true,
					easing: 'easeinout',
					speed: 300,
					animateGradually: {
						enabled: true,
						delay: 50
					},
					dynamicAnimation: {
						enabled: true,
						speed: 350
					}
				}
			},
			series: [],
			dataLabels: { enabled: false },
			title: { 
				text: `Stock ${currentChartType === 'candlestick' ? 'Candlestick' : 'Price'} Chart`, 
				align: 'left',
				style: {
					fontSize: '18px',
					fontWeight: '600'
				}
			},
			grid: {
				show: true,
				borderColor: '#e2e8f0',
				strokeDashArray: 1,
				xaxis: { lines: { show: true } },
				yaxis: { lines: { show: true } }
			},
			xaxis: { 
				type: 'datetime',
				labels: {
					format: currentSelectedTimeframe <= 60 ? 'HH:mm' : 'dd MMM HH:mm',
					style: { fontSize: '11px' },
					rotate: -45
				},
				title: { text: 'Time' }
			},
			yaxis: { 
				title: { text: 'Price ($)' },
				labels: {
					formatter: (value: number) => `${value.toFixed(2)}`
				},
				forceNiceScale: false,
				decimalsInFloat: 2
			},
			legend: { 
				position: 'top', 
				horizontalAlign: 'right',
				markers: { width: 8, height: 8, radius: 4 }
			},
			tooltip: {
				x: { format: 'dd MMM yyyy HH:mm:ss' },
				y: {
					formatter: (value: number) => `${value.toFixed(4)}`
				}
			},
			colors: ['#4299e1', '#48bb78', '#ed8936', '#9f7aea', '#f56565', '#38b2ac'],
			stroke: { 
				curve: 'straight',
				width: 2,
				lineCap: 'round'
			}
		};

		if (currentChartType === 'candlestick') {
			return {
				...baseOptions,
				plotOptions: {
					candlestick: {
						colors: {
							upward: '#00B746',
							downward: '#EF403C'
						},
						wick: {
							useFillColor: true
						}
					}
				},
				tooltip: {
					custom: function({seriesIndex, dataPointIndex, w}: any) {
						const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
						if (!data) return '';
						
						return `
							<div class="candlestick-tooltip">
								<div><strong>Open:</strong> ${data.y[0].toFixed(2)}</div>
								<div><strong>High:</strong> ${data.y[1].toFixed(2)}</div>
								<div><strong>Low:</strong> ${data.y[2].toFixed(2)}</div>
								<div><strong>Close:</strong> ${data.y[3].toFixed(2)}</div>
							</div>
						`;
					}
				}
			};
		} else if (currentChartType === 'area') {
			return {
				...baseOptions,
				stroke: { curve: 'smooth', width: 2 },
				fill: {
					type: 'gradient',
					gradient: {
						shadeIntensity: 1,
						opacityFrom: 0.7,
						opacityTo: 0.1,
						stops: [0, 100]
					}
				}
			};
		} else if (currentChartType === 'volume') {
			return {
				...baseOptions,
				chart: {
					...baseOptions.chart,
					type: 'bar'
				},
				plotOptions: {
					bar: {
						columnWidth: '80%'
					}
				},
				yaxis: {
					...baseOptions.yaxis,
					title: { text: 'Volume' },
					labels: {
						formatter: (value: number) => `${(value / 1000000).toFixed(1)}M`
					}
				}
			};
		} else {
			return {
				...baseOptions,
				stroke: { 
					curve: 'straight',
					width: 2,
					lineCap: 'round'
				}
			};
		}
	}

	async function loadStockData(): Promise<void> {
		if (!browser) return;
		
		loading.set(true);
		const currentTime = Date.now();
		
		for (const symbol of currentFollowedStocks) {
			try {
				const quoteResponse = await fetch(`${API_BASE}/quote/${symbol}`);
				
				if (!quoteResponse.ok) {
					throw new Error(`HTTP error! status: ${quoteResponse.status}`);
				}

				const quote: StockQuote = await quoteResponse.json();
				
				const existingData = currentStockData[symbol] || {
					quote: quote,
					candles: { c: [], h: [], l: [], o: [], s: 'ok', t: [], v: [] },
					priceHistory: [],
					candleHistory: []
				};

				const basePrice = quote.c;
				const currentPrice = basePrice;

				updateCandleData(symbol, currentTime, currentPrice, existingData);

				const newPricePoint: PricePoint = {
					timestamp: currentTime,
					price: currentPrice
				};

				const updatedHistory = [...existingData.priceHistory, newPricePoint]
					.slice(-MAX_HISTORY_POINTS);

				currentStockData[symbol] = {
					quote: { ...quote, c: currentPrice },
					candles: existingData.candles,
					priceHistory: updatedHistory,
					candleHistory: existingData.candleHistory
				};

			} catch (error) {
				console.error(`Failed to load data for ${symbol}:`, error);
			}
		}
		
		stockData.set(currentStockData);
		updateChart();
		lastUpdateTime.set(new Date().toLocaleTimeString());
		loading.set(false);
		
		saveDataToStorage();
	}

	function updateCandleData(symbol: string, timestamp: number, price: number, existingData: StockData): void {
		const candleStartTime = Math.floor(timestamp / CANDLE_INTERVAL_MS) * CANDLE_INTERVAL_MS;
		
		let currentCandle = currentCandleData[symbol];
		
		if (!currentCandle || currentCandle.timestamp !== candleStartTime) {
			currentCandle = {
				timestamp: candleStartTime,
				open: price,
				high: price,
				low: price,
				close: price,
				volume: Math.floor(Math.random() * 1000000)
			};
			currentCandleData[symbol] = currentCandle;
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

	function updateChart(): void {
		if (!browser || !chart) return;

		const now = Date.now();
		const timeframeMs = currentSelectedTimeframe * 60 * 1000;
		const startTime = now - timeframeMs;

		if (currentChartType === 'candlestick') {
			updateCandlestickChart(startTime, now);
		} else if (currentChartType === 'volume') {
			updateVolumeChart(startTime, now);
		} else {
			updateLineChart(startTime, now);
		}
	}

	function updateCandlestickChart(startTime: number, endTime: number): void {
		const series = currentFollowedStocks.map(symbol => {
			const data = currentStockData[symbol];
			if (!data?.candleHistory || data.candleHistory.length === 0) {
				return { name: symbol, data: [] };
			}

			const filteredCandles = data.candleHistory.filter(
				candle => candle.timestamp >= startTime && candle.timestamp <= endTime
			);

			const chartData = filteredCandles.map(candle => ({
				x: candle.timestamp,
				y: [candle.open, candle.high, candle.low, candle.close]
			}));

			return { name: symbol, data: chartData };
		});

		chart.updateSeries(series);
		updateTimeAxis(startTime, endTime);
	}

	function updateVolumeChart(startTime: number, endTime: number): void {
		const series = currentFollowedStocks.map(symbol => {
			const data = currentStockData[symbol];
			if (!data?.candleHistory || data.candleHistory.length === 0) {
				return { name: symbol, data: [] };
			}

			const filteredCandles = data.candleHistory.filter(
				candle => candle.timestamp >= startTime && candle.timestamp <= endTime
			);

			const chartData = filteredCandles.map(candle => [
				candle.timestamp,
				candle.volume
			]);

			return { name: symbol, data: chartData };
		});

		chart.updateSeries(series);
		updateTimeAxis(startTime, endTime);
	}

	function updateLineChart(startTime: number, endTime: number): void {
		const series = currentFollowedStocks.map(symbol => {
			const data = currentStockData[symbol];
			if (!data?.priceHistory || data.priceHistory.length === 0) {
				return { name: symbol, data: [] };
			}

			const filteredHistory = data.priceHistory.filter(
				point => point.timestamp >= startTime && point.timestamp <= endTime
			);

			const chartData: [number, number][] = filteredHistory.map(point => [
				point.timestamp,
				point.price
			]);

			return { name: symbol, data: chartData };
		});

		chart.updateSeries(series);
		updateTimeAxis(startTime, endTime);
	}

	function updateTimeAxis(startTime: number, endTime: number): void {
		chart.updateOptions({
			xaxis: {
				min: startTime,
				max: endTime,
				labels: {
					format: currentSelectedTimeframe <= 60 ? 'HH:mm' : 'dd MMM HH:mm'
				}
			}
		});
	}

	function loadStoredData(): void {
		// Only load data if we're in the browser
		if (!browser) return;
		
		try {
			// Load stock data
			const stored = localStorage.getItem('stockTrackerData');
			if (stored) {
				const parsedData = JSON.parse(stored);
				Object.keys(parsedData).forEach(symbol => {
					if (parsedData[symbol]) {
						parsedData[symbol].candleHistory = parsedData[symbol].candleHistory || [];
						parsedData[symbol].priceHistory = parsedData[symbol].priceHistory || [];
					}
				});
				
				currentStockData = parsedData;
				stockData.set(currentStockData);
				console.log('Loaded stored data for', Object.keys(parsedData).length, 'stocks');
			}
			
			// Load followed stocks
			const storedStocks = localStorage.getItem('followedStocks');
			if (storedStocks) {
				const parsedStocks = JSON.parse(storedStocks);
				currentFollowedStocks = parsedStocks;
				followedStocks.set(currentFollowedStocks);
				console.log('Loaded followed stocks:', parsedStocks);
			}
		} catch (error) {
			console.error('Failed to load stored data:', error);
		}
	}

	function saveDataToStorage(): void {
		// Only save data if we're in the browser
		if (!browser) return;
		
		try {
			// Save stock data
			const dataToSave: Record<string, StockData> = {};
			const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
			
			Object.keys(currentStockData).forEach(symbol => {
				const data = currentStockData[symbol];
				dataToSave[symbol] = {
					...data,
					priceHistory: data.priceHistory.filter(p => p.timestamp > dayAgo),
					candleHistory: data.candleHistory.filter(c => c.timestamp > dayAgo)
				};
			});
			
			localStorage.setItem('stockTrackerData', JSON.stringify(dataToSave));
			
			// Save followed stocks
			localStorage.setItem('followedStocks', JSON.stringify(currentFollowedStocks));
			
			console.log('Saved data for', Object.keys(dataToSave).length, 'stocks and', currentFollowedStocks.length, 'followed stocks');
		} catch (error) {
			console.error('Failed to save data:', error);
		}
	}

	function handleChangeChartType(newType: ChartType): void {
		chartType.set(newType);
		if (chart) {
			chart.destroy();
			initChart();
		}
	}

	function handleChangeTimeframe(minutes: number): void {
		selectedTimeframe.set(minutes);
		updateChart();
	}

	async function handleSearchStocks(): Promise<void> {
		if (!browser || !currentSearchQuery.trim()) {
			searchResults.set([]);
			return;
		}

		try {
			const response = await fetch(`${API_BASE}/search/${encodeURIComponent(currentSearchQuery)}`);
			
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data: SearchResponse = await response.json();
			searchResults.set(data.result || []);
		} catch (error) {
			console.error('Search failed:', error);
			searchResults.set([]);
		}
	}

	function handleAddStock(symbol: string): void {
		if (!currentFollowedStocks.includes(symbol)) {
			const newStocks = [...currentFollowedStocks, symbol];
			currentFollowedStocks = newStocks;
			followedStocks.set(newStocks);
			loadStockData();
			saveDataToStorage(); // Save immediately after adding
		}
		searchQuery.set('');
		searchResults.set([]);
	}

	function handleRemoveStock(symbol: string): void {
		const newStocks = currentFollowedStocks.filter(s => s !== symbol);
		currentFollowedStocks = newStocks;
		followedStocks.set(newStocks);
		
		const newStockData = { ...currentStockData };
		delete newStockData[symbol];
		currentStockData = newStockData;
		stockData.set(currentStockData);
		updateChart();
		saveDataToStorage(); // Save immediately after removing
	}

	function handleClearHistory(): void {
		Object.keys(currentStockData).forEach(symbol => {
			currentStockData[symbol].priceHistory = [];
			currentStockData[symbol].candleHistory = [];
		});
		currentCandleData = {};
		stockData.set(currentStockData);
		updateChart();
		// Only clear localStorage if we're in the browser
		if (browser) {
			localStorage.removeItem('stockTrackerData');
		}
	}

	const formatPrice = (price: number | undefined): string => 
		price ? `$${price.toFixed(2)}` : 'N/A';

	const formatPercent = (percent: number | undefined): string => {
		if (!percent) return 'N/A';
		const sign = percent > 0 ? '+' : '';
		return `${sign}${percent.toFixed(2)}%`;
	};

	const getDataPointCount = (symbol: string): number => {
		const data = currentStockData[symbol];
		if (!data) return 0;
		return Math.max(
			data.priceHistory?.length || 0,
			data.candleHistory?.length || 0
		);
	};

	return {
		// Stores for reactive state
		followedStocks,
		stockData,
		searchQuery,
		searchResults,
		loading,
		lastUpdateTime,
		chartType,
		selectedTimeframe,
		
		// Methods
		initialize,
		cleanup,
		changeChartType: handleChangeChartType,
		changeTimeframe: handleChangeTimeframe,
		searchStocks: handleSearchStocks,
		addStock: handleAddStock,
		removeStock: handleRemoveStock,
		clearHistory: handleClearHistory,
		formatPrice,
		formatPercent,
		getDataPointCount
	};
}