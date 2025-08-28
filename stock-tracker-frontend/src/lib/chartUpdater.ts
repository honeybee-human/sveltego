import type { StockData, ChartType } from '../types';

type ApexCharts = any;

export class ChartUpdater {
	private chart: ApexCharts;

	constructor(chart: ApexCharts) {
		this.chart = chart;
	}

	updateChart(
		chartType: ChartType,
		selectedTimeframe: number,
		followedStocks: string[],
		stockData: Record<string, StockData>
	): void {
		if (!this.chart) return;

		const now = Date.now();
		const timeframeMs = selectedTimeframe * 60 * 1000;
		const startTime = now - timeframeMs;

		if (chartType === 'candlestick') {
			this.updateCandlestickChart(startTime, now, followedStocks, stockData);
		} else if (chartType === 'volume') {
			this.updateVolumeChart(startTime, now, followedStocks, stockData);
		} else {
			this.updateLineChart(startTime, now, followedStocks, stockData);
		}
	}

	private updateCandlestickChart(
		startTime: number,
		endTime: number,
		followedStocks: string[],
		stockData: Record<string, StockData>
	): void {
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

		this.chart.updateSeries(series);
		this.updateTimeAxis(startTime, endTime);
	}

	private updateVolumeChart(
		startTime: number,
		endTime: number,
		followedStocks: string[],
		stockData: Record<string, StockData>
	): void {
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

		this.chart.updateSeries(series);
		this.updateTimeAxis(startTime, endTime);
	}

	private updateLineChart(
		startTime: number,
		endTime: number,
		followedStocks: string[],
		stockData: Record<string, StockData>
	): void {
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

		this.chart.updateSeries(series);
		this.updateTimeAxis(startTime, endTime);
	}

	private updateTimeAxis(startTime: number, endTime: number): void {
		const selectedTimeframe = (endTime - startTime) / (60 * 1000); // Convert back to minutes
		this.chart.updateOptions({
			xaxis: {
				min: startTime,
				max: endTime,
				labels: {
					format: selectedTimeframe <= 60 ? 'HH:mm' : 'dd MMM HH:mm'
				}
			}
		});
	}
}