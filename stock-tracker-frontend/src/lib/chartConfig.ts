import type { ChartType } from '../types';

type ApexOptions = any;

export function getChartOptions(
	chartType: ChartType,
	selectedTimeframe: number
): ApexOptions {
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
		series: [],
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
							<div><strong>Open:</strong> ${data.y[0].toFixed(2)}</div>
							<div><strong>High:</strong> ${data.y[1].toFixed(2)}</div>
							<div><strong>Low:</strong> ${data.y[2].toFixed(2)}</div>
							<div><strong>Close:</strong> ${data.y[3].toFixed(2)}</div>
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