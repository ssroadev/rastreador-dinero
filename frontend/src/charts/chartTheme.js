/**
 * Shared ECharts configuration — dark institutional theme.
 * Inspired by mempool.space / Glassnode aesthetics.
 */

export const COLORS = {
  orange: '#f7931a',
  blue:   '#3b82f6',
  green:  '#00c781',
  red:    '#f6465d',
  purple: '#8b5cf6',
  cyan:   '#06b6d4',
  yellow: '#f59e0b',
  gray:   '#4a5e73',
};

export const PALETTE = [
  '#f7931a', '#3b82f6', '#00c781', '#f59e0b',
  '#8b5cf6', '#06b6d4', '#f6465d', '#94a3b8',
];

export const BG_TRANSPARENT = 'transparent';

/* Tooltip */
export const tooltip = {
  backgroundColor: '#111820',
  borderColor: '#1c2a3a',
  borderWidth: 1,
  extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,.6); border-radius: 5px;',
  textStyle: { color: '#e6edf3', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' },
  axisPointer: {
    lineStyle:  { color: '#243447', width: 1, type: 'dashed' },
    crossStyle: { color: '#243447' },
  },
};

/* Grid */
export const grid = (overrides = {}) => ({
  left: 56, right: 24, top: 24, bottom: 48,
  containLabel: false,
  ...overrides,
});

/* X axis — time */
export const xAxisTime = {
  type: 'time',
  axisLine: { lineStyle: { color: '#1c2a3a' } },
  axisTick: { lineStyle: { color: '#1c2a3a' } },
  axisLabel: { color: '#4a5e73', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
  splitLine: { show: false },
};

/* X axis — category */
export const xAxisCategory = (data, extra = {}) => ({
  type: 'category',
  data,
  axisLine: { lineStyle: { color: '#1c2a3a' } },
  axisTick: { lineStyle: { color: '#1c2a3a' } },
  axisLabel: { color: '#4a5e73', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
  splitLine: { show: false },
  ...extra,
});

/* Y axis */
export const yAxis = (extra = {}) => ({
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: '#4a5e73', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
  splitLine: { lineStyle: { color: '#1c2a3a', type: 'solid', opacity: .5 } },
  nameTextStyle: { color: '#4a5e73', fontSize: 11 },
  ...extra,
});

/* Legend */
export const legend = (extra = {}) => ({
  top: 4,
  right: 8,
  textStyle: { color: '#7d8fa3', fontSize: 11 },
  itemWidth: 10, itemHeight: 10,
  icon: 'roundRect',
  ...extra,
});

/* Line series base */
export const lineSeries = (name, data, color, extra = {}) => ({
  name,
  type: 'line',
  data,
  smooth: true,
  lineStyle: { color, width: 1.5 },
  itemStyle: { color },
  areaStyle: { color: `${color}18` },
  symbol: 'none',
  ...extra,
});

/* Bar series base */
export const barSeries = (name, data, color, extra = {}) => ({
  name,
  type: 'bar',
  data,
  itemStyle: { color, borderRadius: [3, 3, 0, 0] },
  ...extra,
});
