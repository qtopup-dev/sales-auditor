import { useThemeStore } from '../stores/themeStore';

// Recharts takes literal color props — it can't read Tailwind classes, so
// chart colors switch with the theme here.
export function useChartColors() {
  const theme = useThemeStore((s) => s.theme);
  return theme === 'dark'
    ? {
        grid: '#374151',        // gray-700
        axis: '#9ca3af',        // gray-400
        accent: '#3b82f6',      // blue-500 — brighter on dark surfaces
        tooltipBg: '#1f2937',   // gray-800
        tooltipBorder: '#374151',
        tooltipText: '#f3f4f6', // gray-100
      }
    : {
        grid: '#e5e7eb',        // gray-200
        axis: '#6b7280',        // gray-500
        accent: '#2563eb',      // blue-600
        tooltipBg: '#ffffff',
        tooltipBorder: '#e5e7eb',
        tooltipText: '#111827', // gray-900
      };
}
