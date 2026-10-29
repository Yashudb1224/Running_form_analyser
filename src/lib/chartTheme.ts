import type { ResolvedTheme } from "../components/ThemeProvider";

/** Chart colors as hex values; SVG chart props cannot read the CSS theme variables directly. */
export interface ChartPalette {
  axis: string;
  grid: string;
  left: string;
  right: string;
  neutral: string;
  band: string;
  track: string;
  tooltipBackground: string;
  tooltipBorder: string;
  tooltipText: string;
  cursor: string;
  success: string;
  warning: string;
  danger: string;
  ink: string;
  muted: string;
}

const PALETTES: Record<ResolvedTheme, ChartPalette> = {
  light: {
    axis: "#5F6B7A",
    grid: "#EDF0F3",
    left: "#2F5D8A",
    right: "#B9733F",
    neutral: "#6B7686",
    band: "#2F7356",
    track: "#E7EAEE",
    tooltipBackground: "#FFFFFF",
    tooltipBorder: "#E2E5EA",
    tooltipText: "#13213A",
    cursor: "#F4F5F7",
    success: "#2F7356",
    warning: "#A86C12",
    danger: "#A9443B",
    ink: "#13213A",
    muted: "#5F6B7A",
  },
  dark: {
    axis: "#8B96A6",
    grid: "#243045",
    left: "#7AA6D6",
    right: "#DEA070",
    neutral: "#A3AEBD",
    band: "#62B48D",
    track: "#2A3446",
    tooltipBackground: "#1A2231",
    tooltipBorder: "#2A3446",
    tooltipText: "#E8EDF4",
    cursor: "#202939",
    success: "#62B48D",
    warning: "#DCA550",
    danger: "#E27A70",
    ink: "#E8EDF4",
    muted: "#8B96A6",
  },
};

export function getChartPalette(theme: ResolvedTheme): ChartPalette {
  return PALETTES[theme];
}
