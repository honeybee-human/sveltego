import { browser } from '$app/environment';
import { appStore } from '../stores/appStore';
import { chartStore } from '../stores/chartStore';
import { stockStore } from '../stores/stockStore';
import { storageStore } from '../stores/storageStore';
import { getChartOptions } from './chartConfig';
import { ChartUpdater } from './chartUpdater';
import { DataLoader } from './dataLoader';
import { formatPrice, formatPercent, getDataPointCount } from '../utils/stockUtils';
import type { ChartType } from '../types';

type ApexCharts = any;

export function createStockTracker() {
	// Internal state
	let chart: ApexCharts;
	let ApexChartsClass: any = null;
	let intervalId: number | null = null;
	let chartContainer: HTMLElement;
	let chartUpdater: ChartUpdater;
	let dataLoader: DataLoader;

	// Current values for internal use
	let currentFollowedStocks: string[] = [];
	let currentStockData: Record<string, any> = {};
	let currentSearchQuery: string = '';
	let currentChartType: ChartType = 'area';
	let currentSelectedTimeframe: number = 30;

	// Subscribe to store changes to keep internal state in sync
	appStore.followedStocks.subscribe(value => currentFollowedStocks = value);
	stockStore.stockData.subscribe(value => currentStockData = value);
	appStore.searchQuery.subscribe(value => currentSearchQuery = value);
	chartStore.chartType.subscribe(value => currentChartType = value);
	chartStore.selectedTimeframe.subscribe(value => currentSelectedTimeframe = value);

	async function initialize(container: HTMLElement) {
		if (!browser) return;
		
		chartContainer = container;
		dataLoader = new DataLoader();
		
		const ApexChartsModule = await import('apexcharts');
		ApexChartsClass = ApexChartsModule.default;
		
		// Load stored data using storageStore
		storageStore.loadStoredData();
		
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
		// Save data using storageStore
		if (browser) {
			storageStore.saveDataToStorage();
		}
	}

	function initChart(): void {
		if (!browser || !chartContainer || !ApexChartsClass) return;

		const options = getChartOptions(currentChartType, currentSelectedTimeframe);
		chart = new ApexChartsClass(chartContainer, options);
		chart.render();
		
		chartUpdater = new ChartUpdater(chart);
		updateChart();
	}

	async function loadStockData(): Promise<void> {
		if (!browser) return;
		
		appStore.setLoading(true);
		
		try {
			const updatedStockData = await dataLoader.loadStockData(currentFollowedStocks, currentStockData);
			stockStore.setStockData(updatedStockData);
			updateChart();
			appStore.setLastUpdateTime(new Date().toLocaleTimeString());
			
			// Save data using storageStore
			storageStore.saveDataToStorage();
		} catch (error) {
			console.error('Failed to load stock data:', error);
		} finally {
			appStore.setLoading(false);
		}
	}

	function updateChart(): void {
		if (!browser || !chartUpdater) return;
		chartUpdater.updateChart(currentChartType, currentSelectedTimeframe, currentFollowedStocks, currentStockData);
	}

	function handleChangeChartType(newType: ChartType): void {
		chartStore.setChartType(newType);
		if (chart) {
			chart.destroy();
			initChart();
		}
	}

	function handleChangeTimeframe(minutes: number): void {
		chartStore.setSelectedTimeframe(minutes);
		updateChart();
	}

	async function handleSearchStocks(): Promise<void> {
		if (!browser || !currentSearchQuery.trim()) {
			appStore.setSearchResults([]);
			return;
		}

		try {
			const searchResponse = await dataLoader.searchStocks(currentSearchQuery);
			appStore.setSearchResults(searchResponse.result || []);
		} catch (error) {
			console.error('Search failed:', error);
			appStore.setSearchResults([]);
		}
	}

	function handleAddStock(symbol: string): void {
		if (!currentFollowedStocks.includes(symbol)) {
			appStore.addFollowedStock(symbol);
			loadStockData();
			storageStore.saveDataToStorage(); // Save immediately after adding
		}
		appStore.setSearchQuery('');
		appStore.setSearchResults([]);
	}

	function handleRemoveStock(symbol: string): void {
		appStore.removeFollowedStock(symbol);
		stockStore.removeStock(symbol);
		updateChart();
		storageStore.saveDataToStorage(); // Save immediately after removing
	}

	function handleClearHistory(): void {
		stockStore.clearHistory();
		dataLoader.clearCandleData();
		updateChart();
		// Clear localStorage using storageStore
		if (browser) {
			storageStore.clearStoredData();
		}
	}

	return {
		// Stores for reactive state
		followedStocks: appStore.followedStocks,
		stockData: stockStore.stockData,
		searchQuery: appStore.searchQuery,
		searchResults: appStore.searchResults,
		loading: appStore.loading,
		lastUpdateTime: appStore.lastUpdateTime,
		chartType: chartStore.chartType,
		selectedTimeframe: chartStore.selectedTimeframe,
		
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
		getDataPointCount: (symbol: string) => getDataPointCount(symbol, currentStockData)
	};
}