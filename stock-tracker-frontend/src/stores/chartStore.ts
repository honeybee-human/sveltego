import { writable } from 'svelte/store';
import type { ChartType } from '../types';

function createChartStore() {
    const chartType = writable<ChartType>('area');
    const selectedTimeframe = writable<number>(30);
    
    return {
        chartType,
        selectedTimeframe,
        setChartType: (type: ChartType) => chartType.set(type),
        setTimeframe: (minutes: number) => selectedTimeframe.set(minutes),
        setSelectedTimeframe: (minutes: number) => selectedTimeframe.set(minutes)
    };
}

export const chartStore = createChartStore();