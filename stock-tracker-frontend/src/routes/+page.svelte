<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import TradingPanel from '../components/TradingPanel.svelte';
	import { 
		createStockTracker,
		type StockData,
		type SearchResult,
		type ChartType
	} from '../lib/appLogic.js';

	// Create the stock tracker instance
	const stockTracker = createStockTracker();

	// Destructure stores from the tracker for proper reactivity
	const {
		followedStocks: followedStocksStore,
		stockData: stockDataStore,
		searchQuery: searchQueryStore,
		searchResults: searchResultsStore,
		loading: loadingStore,
		lastUpdateTime: lastUpdateTimeStore,
		chartType: chartTypeStore,
		selectedTimeframe: selectedTimeframeStore,
		// Methods
		initialize,
		cleanup,
		changeChartType,
		changeTimeframe,
		searchStocks,
		addStock,
		removeStock,
		clearHistory,
		formatPrice,
		formatPercent,
		getDataPointCount
	} = stockTracker;

	// Reactive state from the stores
	$: followedStocks = $followedStocksStore;
	$: stockData = $stockDataStore;
	$: searchQuery = $searchQueryStore;
	$: searchResults = $searchResultsStore;
	$: loading = $loadingStore;
	$: lastUpdateTime = $lastUpdateTimeStore;
	$: chartType = $chartTypeStore;
	$: selectedTimeframe = $selectedTimeframeStore;

	let chartContainer: HTMLElement;

	onMount(() => {
		if (browser) {
			initialize(chartContainer);
		}
	});

	onDestroy(() => {
		cleanup();
	});

	// Event handlers - now using the destructured methods
	const handleSearchInput = () => {
		searchStocks();
	};
</script>

<main>
	<div class="container">
	

		<div class="main-content">
			<div class="trading-section">
				<TradingPanel />
			</div>

			<div class="stock-section">
				<div class="controls">
					<div class="chart-type-controls">
						<label>Chart Type:</label>
						<button 
							class="chart-type-btn" 
							class:active={chartType === 'line'}
							on:click={() => changeChartType('line')}
						>
							Line
						</button>
						<button 
							class="chart-type-btn" 
							class:active={chartType === 'candlestick'}
							on:click={() => changeChartType('candlestick')}
						>
							Candlestick
						</button>
						<button 
							class="chart-type-btn" 
							class:active={chartType === 'area'}
							on:click={() => changeChartType('area')}
						>
							Area
						</button>
						<button 
							class="chart-type-btn" 
							class:active={chartType === 'volume'}
							on:click={() => changeChartType('volume')}
						>
							Volume
						</button>
					</div>

					<div class="timeframe-controls">
						<label>Timeframe:</label>
						<button 
							class="timeframe-btn" 
							class:active={selectedTimeframe === 5}
							on:click={() => changeTimeframe(5)}
						>
							5min
						</button>
						<button 
							class="timeframe-btn" 
							class:active={selectedTimeframe === 15}
							on:click={() => changeTimeframe(15)}
						>
							15min
						</button>
						<button 
							class="timeframe-btn" 
							class:active={selectedTimeframe === 30}
							on:click={() => changeTimeframe(30)}
						>
							30min
						</button>
						<button 
							class="timeframe-btn" 
							class:active={selectedTimeframe === 60}
							on:click={() => changeTimeframe(60)}
						>
							1hr
						</button>
						<button 
							class="timeframe-btn" 
							class:active={selectedTimeframe === 240}
							on:click={() => changeTimeframe(240)}
						>
							4hr
						</button>
						<button 
							class="timeframe-btn" 
							class:active={selectedTimeframe === 1440}
							on:click={() => changeTimeframe(1440)}
						>
							1day
						</button>
					</div>

					<button class="clear-btn" on:click={clearHistory}>
						Clear
					</button>
							{#if lastUpdateTime}
				<p class="last-update">Last updated: {lastUpdateTime}</p>
			{/if}
				</div>

				<div class="search-section">
					<div class="search-box">
						<input
							type="text"
							placeholder="Follow stocks (e.g., AAPL, GOOGL, AMD)"
							bind:value={$searchQueryStore}
							on:input={handleSearchInput}
						/>
					</div>
					
					{#if searchResults.length > 0}
						<div class="search-results">
							{#each searchResults.slice(0, 5) as result}
								<div class="search-result" 
									role="button" 
									tabindex="0"
									on:click={() => addStock(result.symbol)}
									on:keydown={(e) => e.key === 'Enter' && addStock(result.symbol)}
								>
									<strong>{result.symbol}</strong> - {result.description}
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div class="stocks-section">
					<div class="stock-cards">
						{#each followedStocks as symbol}
							<div class="stock-card">
								<div class="stock-header">
									<h3>{symbol}</h3>
									<div class="stock-meta">
										<span class="data-points">{getDataPointCount(symbol)} points</span>
										<button 
											class="remove-btn"
											on:click={() => removeStock(symbol)}
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
										<div class="row">
										<div class="change" class:positive={stockData[symbol].quote.d > 0} class:negative={stockData[symbol].quote.d < 0}>
											{formatPrice(stockData[symbol].quote.d)} ({formatPercent(stockData[symbol].quote.dp)})
										</div>
										<div class="details">
											Open: {formatPrice(stockData[symbol].quote.o)}
											| High: {formatPrice(stockData[symbol].quote.h)}
											| Low: {formatPrice(stockData[symbol].quote.l)}
										</div>
										</div>
									</div>
								{:else}
									<div class="loading">Loading...</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>

				<div class="chart-section">
					<div bind:this={chartContainer}></div>
				</div>
			</div>
		</div>

		{#if loading}
			<div class="loading-indicator">
				<div class="spinner"></div>
			</div>
		{/if}
	</div>
</main>

<style>
	@import '../styles/page.css';
</style>