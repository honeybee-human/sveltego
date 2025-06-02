<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import '../styles/page.css';

	// Type definitions
	interface StockQuote {
		c: number; // current price
		d: number; // change
		dp: number; // percent change
		h: number; // high
		l: number; // low
		o: number; // open
		pc: number; // previous close
		t: number; // timestamp
	}

	interface StockCandles {
		c: number[]; // close prices
		h: number[]; // high prices
		l: number[]; // low prices
		o: number[]; // open prices
		s: string; // status
		t: number[]; // timestamps
		v: number[]; // volumes
	}

	interface PricePoint {
		timestamp: number;
		price: number;
	}

	interface CandlePoint {
		timestamp: number;
		open: number;
		high: number;
		low: number;
		close: number;
		volume: number;
	}

	interface StockData {
		quote: StockQuote;
		candles: StockCandles;
		priceHistory: PricePoint[];
		candleHistory: CandlePoint[]; // New: candlestick data
	}

	interface SearchResult {
		description: string;
		displaySymbol: string;
		symbol: string;
		type: string;
	}

	interface SearchResponse {
		count: number;
		result: SearchResult[];
	}

	// ApexCharts types
	type ApexCharts = any;
	type ApexOptions = any;
	type ChartType = 'line' | 'candlestick' | 'area' | 'volume';

	// State management
	let followedStocks = $state<string[]>(['AAPL', 'GOOGL', 'MSFT', 'TSLA']);
	let stockData = $state<Record<string, StockData>>({});
	let chartContainer = $state<HTMLElement>();
	let chart = $state<ApexCharts>();
	let searchQuery = $state<string>('');
	let searchResults = $state<SearchResult[]>([]);
	let loading = $state<boolean>(false);
	let ApexChartsClass = $state<any>(null);
	let lastUpdateTime = $state<string>('');
	let chartType = $state<ChartType>('line');
	let selectedTimeframe = $state<number>(30); // minutes

	const API_BASE: string = 'http://localhost:8080/api';
	const MAX_HISTORY_POINTS = 500; // Increased for better historical view
	const CANDLE_INTERVAL_MS = 60000; // 1 minute candles
	let intervalId: number | null = null;
	let currentCandleData = $state<Record<string, CandlePoint>>({});

	onMount(async () => {
		if (browser) {
			// Dynamically import ApexCharts
			const ApexChartsModule = await import('apexcharts');
			ApexChartsClass = ApexChartsModule.default;
			
			// Initialize with stored data FIRST to prevent empty start
			loadStoredData();
			
			// Then initialize chart with existing data
			initChart();
			
			// Load new data without clearing existing
			await loadStockData();
			
			// Update every 15 seconds for more responsive tracking
			intervalId = setInterval(loadStockData, 15000);
		}
	});

	onDestroy(() => {
		if (intervalId) {
			clearInterval(intervalId);
		}
		if (chart) {
			chart.destroy();
		}
		// Save data before component unmounts
		saveDataToStorage();
	});

	function initChart(): void {
		if (!browser || !chartContainer || !ApexChartsClass) return;

		const options: ApexOptions = getChartOptions();
		chart = new ApexChartsClass(chartContainer, options);
		chart.render();
		
		// Update chart with existing data immediately
		updateChart();
	}

	function getChartOptions(): ApexOptions {
		const baseOptions = {
			chart: {
				type: chartType === 'candlestick' ? 'candlestick' : chartType,
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
			series: [], // Initialize empty series
			dataLabels: { enabled: false },
			title: { 
				text: `Stock ${chartType === 'candlestick' ? 'Candlestick' : 'Price'} Chart`, 
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
					format: selectedTimeframe <= 60 ? 'HH:mm' : 'dd MMM HH:mm',
					style: { fontSize: '11px' },
					rotate: -45
				},
				title: { text: 'Time' }
			},
			yaxis: { 
				title: { text: 'Price ($)' },
				labels: {
					formatter: (value: number) => `$${value.toFixed(2)}`
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
					formatter: (value: number) => `$${value.toFixed(4)}`
				}
			},
			colors: ['#4299e1', '#48bb78', '#ed8936', '#9f7aea', '#f56565', '#38b2ac'],
			stroke: { 
				curve: 'straight',
				width: 2,
				lineCap: 'round'
			}
		};

		// Specific options for different chart types
		if (chartType === 'candlestick') {
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
								<div><strong>Open:</strong> $${data.y[0].toFixed(2)}</div>
								<div><strong>High:</strong> $${data.y[1].toFixed(2)}</div>
								<div><strong>Low:</strong> $${data.y[2].toFixed(2)}</div>
								<div><strong>Close:</strong> $${data.y[3].toFixed(2)}</div>
							</div>
						`;
					}
				}
			};
		} else if (chartType === 'area') {
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
		} else if (chartType === 'volume') {
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
		
		loading = true;
		const currentTime = Date.now();
		
		for (const symbol of followedStocks) {
			try {
				const quoteResponse = await fetch(`${API_BASE}/quote/${symbol}`);
				
				if (!quoteResponse.ok) {
					throw new Error(`HTTP error! status: ${quoteResponse.status}`);
				}

				const quote: StockQuote = await quoteResponse.json();
				
				// Get existing data or create new - PRESERVE existing history
				const existingData = stockData[symbol] || {
					quote: quote,
					candles: { c: [], h: [], l: [], o: [], s: 'ok', t: [], v: [] },
					priceHistory: [],
					candleHistory: []
				};

				// Create realistic price variation for demo
				const basePrice = quote.c;
				const variation = (Math.random() - 0.5) * (basePrice * 0.002); // ±0.2% variation
				const currentPrice = Math.max(0, basePrice + variation);

				// Update current candle or create new one
				updateCandleData(symbol, currentTime, currentPrice, existingData);

				// Add new price point to history
				const newPricePoint: PricePoint = {
					timestamp: currentTime,
					price: currentPrice
				};

				// Preserve existing history and add new point
				const updatedHistory = [...existingData.priceHistory, newPricePoint]
					.slice(-MAX_HISTORY_POINTS);

				// Update stock data while preserving history
				stockData[symbol] = {
					quote: { ...quote, c: currentPrice }, // Update current price
					candles: existingData.candles,
					priceHistory: updatedHistory,
					candleHistory: existingData.candleHistory
				};

			} catch (error) {
				console.error(`Failed to load data for ${symbol}:`, error);
			}
		}
		
		updateChart();
		lastUpdateTime = new Date().toLocaleTimeString();
		loading = false;
		
		// Save to storage periodically
		saveDataToStorage();
	}

	function updateCandleData(symbol: string, timestamp: number, price: number, existingData: StockData): void {
		const candleStartTime = Math.floor(timestamp / CANDLE_INTERVAL_MS) * CANDLE_INTERVAL_MS;
		
		// Get current candle being built
		let currentCandle = currentCandleData[symbol];
		
		if (!currentCandle || currentCandle.timestamp !== candleStartTime) {
			// Start new candle
			currentCandle = {
				timestamp: candleStartTime,
				open: price,
				high: price,
				low: price,
				close: price,
				volume: Math.floor(Math.random() * 1000000) // Demo volume
			};
			currentCandleData[symbol] = currentCandle;
		} else {
			// Update existing candle
			currentCandle.high = Math.max(currentCandle.high, price);
			currentCandle.low = Math.min(currentCandle.low, price);
			currentCandle.close = price;
		}

		// Check if we should close the current candle and add to history
		if (timestamp - candleStartTime >= CANDLE_INTERVAL_MS - 5000) { // Close 5 seconds before next candle
			const candleHistory = [...existingData.candleHistory];
			
			// Replace or add the candle
			const existingIndex = candleHistory.findIndex(c => c.timestamp === candleStartTime);
			if (existingIndex >= 0) {
				candleHistory[existingIndex] = { ...currentCandle };
			} else {
				candleHistory.push({ ...currentCandle });
			}
			
			// Keep last MAX_HISTORY_POINTS candles
			existingData.candleHistory = candleHistory.slice(-MAX_HISTORY_POINTS);
		}
	}

	function updateChart(): void {
		if (!browser || !chart) return;

		const now = Date.now();
		const timeframeMs = selectedTimeframe * 60 * 1000;
		const startTime = now - timeframeMs;

		if (chartType === 'candlestick') {
			updateCandlestickChart(startTime, now);
		} else if (chartType === 'volume') {
			updateVolumeChart(startTime, now);
		} else {
			updateLineChart(startTime, now);
		}
	}

	function updateCandlestickChart(startTime: number, endTime: number): void {
		const series = followedStocks.map(symbol => {
			const data = stockData[symbol];
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
		const series = followedStocks.map(symbol => {
			const data = stockData[symbol];
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
		const series = followedStocks.map(symbol => {
			const data = stockData[symbol];
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
					format: selectedTimeframe <= 60 ? 'HH:mm' : 'dd MMM HH:mm'
				}
			}
		});
	}

	function loadStoredData(): void {
		try {
			const stored = localStorage.getItem('stockTrackerData');
			if (stored) {
				const parsedData = JSON.parse(stored);
				// Load all stored data, don't filter by age on startup
				// This prevents the "empty restart" issue
				Object.keys(parsedData).forEach(symbol => {
					// Ensure all required properties exist
					if (parsedData[symbol]) {
						parsedData[symbol].candleHistory = parsedData[symbol].candleHistory || [];
						parsedData[symbol].priceHistory = parsedData[symbol].priceHistory || [];
					}
				});
				
				stockData = parsedData;
				console.log('Loaded stored data for', Object.keys(parsedData).length, 'stocks');
			}
		} catch (error) {
			console.error('Failed to load stored data:', error);
		}
	}

	function saveDataToStorage(): void {
		try {
			// Only save recent data to prevent localStorage bloat
			const dataToSave: Record<string, StockData> = {};
			const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
			
			Object.keys(stockData).forEach(symbol => {
				const data = stockData[symbol];
				dataToSave[symbol] = {
					...data,
					priceHistory: data.priceHistory.filter(p => p.timestamp > dayAgo),
					candleHistory: data.candleHistory.filter(c => c.timestamp > dayAgo)
				};
			});
			
			localStorage.setItem('stockTrackerData', JSON.stringify(dataToSave));
		} catch (error) {
			console.error('Failed to save data:', error);
		}
	}

	function changeChartType(newType: ChartType): void {
		chartType = newType;
		if (chart) {
			chart.destroy();
			initChart();
		}
	}

	function changeTimeframe(minutes: number): void {
		selectedTimeframe = minutes;
		updateChart();
	}

	async function searchStocks(): Promise<void> {
		if (!browser || !searchQuery.trim()) {
			searchResults = [];
			return;
		}

		try {
			const response = await fetch(`${API_BASE}/search/${encodeURIComponent(searchQuery)}`);
			
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data: SearchResponse = await response.json();
			searchResults = data.result || [];
		} catch (error) {
			console.error('Search failed:', error);
			searchResults = [];
		}
	}

	function addStock(symbol: string): void {
		if (!followedStocks.includes(symbol)) {
			followedStocks = [...followedStocks, symbol];
			loadStockData();
		}
		searchQuery = '';
		searchResults = [];
	}

	function removeStock(symbol: string): void {
		followedStocks = followedStocks.filter(s => s !== symbol);
		const newStockData = { ...stockData };
		delete newStockData[symbol];
		stockData = newStockData;
		updateChart();
	}

	function clearHistory(): void {
		Object.keys(stockData).forEach(symbol => {
			stockData[symbol].priceHistory = [];
			stockData[symbol].candleHistory = [];
		});
		currentCandleData = {};
		updateChart();
		localStorage.removeItem('stockTrackerData');
	}

	const formatPrice = (price: number | undefined): string => 
		price ? `$${price.toFixed(2)}` : 'N/A';

	const formatPercent = (percent: number | undefined): string => {
		if (!percent) return 'N/A';
		const sign = percent > 0 ? '+' : '';
		return `${sign}${percent.toFixed(2)}%`;
	};

	const getDataPointCount = (symbol: string): number => {
		const data = stockData[symbol];
		if (!data) return 0;
		return Math.max(
			data.priceHistory?.length || 0,
			data.candleHistory?.length || 0
		);
	};
</script>

<main>
	<div class="container">
		<header>
			<h1>📈 Advanced Stock Tracker</h1>
			<p>Professional stock tracking with multiple chart types and persistent data</p>
			{#if lastUpdateTime}
				<p class="last-update">Last updated: {lastUpdateTime}</p>
			{/if}
		</header>

		<!-- Enhanced Controls -->
		<div class="controls">
			<div class="chart-type-controls">
				<label>Chart Type:</label>
				<button 
					class="chart-type-btn" 
					class:active={chartType === 'line'}
					onclick={() => changeChartType('line')}
				>
					📈 Line
				</button>
				<button 
					class="chart-type-btn" 
					class:active={chartType === 'candlestick'}
					onclick={() => changeChartType('candlestick')}
				>
					🕯️ Candlestick
				</button>
				<button 
					class="chart-type-btn" 
					class:active={chartType === 'area'}
					onclick={() => changeChartType('area')}
				>
					📊 Area
				</button>
				<button 
					class="chart-type-btn" 
					class:active={chartType === 'volume'}
					onclick={() => changeChartType('volume')}
				>
					📦 Volume
				</button>
			</div>

			<div class="timeframe-controls">
				<label>Timeframe:</label>
				<button 
					class="timeframe-btn" 
					class:active={selectedTimeframe === 5}
					onclick={() => changeTimeframe(5)}
				>
					5min
				</button>
				<button 
					class="timeframe-btn" 
					class:active={selectedTimeframe === 15}
					onclick={() => changeTimeframe(15)}
				>
					15min
				</button>
				<button 
					class="timeframe-btn" 
					class:active={selectedTimeframe === 30}
					onclick={() => changeTimeframe(30)}
				>
					30min
				</button>
				<button 
					class="timeframe-btn" 
					class:active={selectedTimeframe === 60}
					onclick={() => changeTimeframe(60)}
				>
					1hr
				</button>
				<button 
					class="timeframe-btn" 
					class:active={selectedTimeframe === 240}
					onclick={() => changeTimeframe(240)}
				>
					4hr
				</button>
				<button 
					class="timeframe-btn" 
					class:active={selectedTimeframe === 1440}
					onclick={() => changeTimeframe(1440)}
				>
					1day
				</button>
			</div>

			<button class="clear-btn" onclick={clearHistory}>
				🗑️ Clear History
			</button>
			
			<div class="update-info">
				Updates every 15 seconds • Persistent data storage
			</div>
		</div>

		<!-- Search Section -->
		<div class="search-section">
			<div class="search-box">
				<input
					type="text"
					placeholder="Search stocks (e.g., AAPL, GOOGL, AMD)"
					bind:value={searchQuery}
					oninput={searchStocks}
				/>
			</div>
			
			{#if searchResults.length > 0}
				<div class="search-results">
					{#each searchResults.slice(0, 5) as result}
						<div class="search-result" onclick={() => addStock(result.symbol)}>
							<strong>{result.symbol}</strong> - {result.description}
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Followed Stocks -->
		<div class="stocks-section">
			<h2>Followed Stocks</h2>
			<div class="stock-cards">
				{#each followedStocks as symbol}
					<div class="stock-card">
						<div class="stock-header">
							<h3>{symbol}</h3>
							<div class="stock-meta">
								<span class="data-points">{getDataPointCount(symbol)} points</span>
								<button 
									class="remove-btn"
									onclick={() => removeStock(symbol)}
									aria-label="Remove {symbol}"
								>
									✕
								</button>
							</div>
						</div>
						
						{#if stockData[symbol]?.quote}
							<div class="stock-info">
								<div class="price">
									{formatPrice(stockData[symbol].quote.c)}
								</div>
								<div class="change" class:positive={stockData[symbol].quote.d > 0} class:negative={stockData[symbol].quote.d < 0}>
									{formatPrice(stockData[symbol].quote.d)} ({formatPercent(stockData[symbol].quote.dp)})
								</div>
								<div class="details">
									<span>Open: {formatPrice(stockData[symbol].quote.o)}</span>
									<span>High: {formatPrice(stockData[symbol].quote.h)}</span>
									<span>Low: {formatPrice(stockData[symbol].quote.l)}</span>
								</div>
							</div>
						{:else}
							<div class="loading">Loading...</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<!-- Chart Section -->
		<div class="chart-section">
			<div bind:this={chartContainer}></div>
		</div>

		{#if loading}
			<div class="loading-indicator">
				Updating data...
			</div>
		{/if}
	</div>

	<style>
		.controls {
			display: flex;
			flex-wrap: wrap;
			gap: 1rem;
			align-items: center;
			margin-bottom: 1.5rem;
			padding: 1rem;
			background: #f8f9fa;
			border-radius: 8px;
		}

		.chart-type-controls,
		.timeframe-controls {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}

		.chart-type-controls label,
		.timeframe-controls label {
			font-weight: 600;
			margin-right: 0.5rem;
		}

		.chart-type-btn,
		.timeframe-btn {
			padding: 0.5rem 1rem;
			border: 1px solid #ddd;
			background: white;
			border-radius: 4px;
			cursor: pointer;
			transition: all 0.2s;
		}

		.chart-type-btn:hover,
		.timeframe-btn:hover {
			background: #e9ecef;
		}

		.chart-type-btn.active,
		.timeframe-btn.active {
			background: #007bff;
			color: white;
			border-color: #007bff;
		}

		.clear-btn {
			padding: 0.5rem 1rem;
			background: #dc3545;
			color: white;
			border: none;
			border-radius: 4px;
			cursor: pointer;
		}

		.clear-btn:hover {
			background: #c82333;
		}

		.update-info {
			font-size: 0.875rem;
			color: #6c757d;
			margin-left: auto;
		}

		:global(.candlestick-tooltip) {
			padding: 0.5rem;
			background: rgba(0, 0, 0, 0.8);
			color: white;
			border-radius: 4px;
			font-size: 0.875rem;
		}

		:global(.candlestick-tooltip div) {
			margin: 0.25rem 0;
		}
	</style>
</main>