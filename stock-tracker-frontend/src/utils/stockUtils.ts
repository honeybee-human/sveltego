import type { StockData } from '../types';

export function formatPrice(price: number | undefined): string {
    if (price === undefined) return 'N/A';
    return `${price.toFixed(2)}`;
}

export function formatPercent(percent: number | undefined): string {
    if (percent === undefined) return 'N/A';
    const sign = percent > 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
}

export function formatVolume(volume: number | undefined): string {
    if (volume === undefined) return 'N/A';
    if (volume >= 1000000) {
        return `${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
        return `${(volume / 1000).toFixed(2)}K`;
    }
    return volume.toString();
}

export function calculateGainLoss(currentPrice: number, averagePrice: number, quantity: number) {
    const gainLoss = (currentPrice - averagePrice) * quantity;
    const percentGainLoss = ((currentPrice - averagePrice) / averagePrice) * 100;
    return { gainLoss, percentGainLoss };
}

export function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
}

export function getTimeframeLabel(minutes: number): string {
    if (minutes < 60) return `${minutes}min`;
    if (minutes === 60) return '1hr';
    if (minutes < 1440) return `${minutes / 60}hr`;
    return `${minutes / 1440}day`;
}

// Additional utility functions from appLogic.ts
export function getDataPointCount(symbol: string, stockData: Record<string, StockData>): number {
    const data = stockData[symbol];
    if (!data) return 0;
    return Math.max(
        data.priceHistory?.length || 0,
        data.candleHistory?.length || 0
    );
}