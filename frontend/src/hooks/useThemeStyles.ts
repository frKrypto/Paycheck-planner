import { useTheme } from '../context/ThemeContext';

export interface ThemeColors {
  bg: string;
  cardBg: string;
  primary: string;
  primaryLight: string;
  primaryHover: string;
  text: string;
  subtle: string;
  border: string;
  red: string;
  amber: string;
  green: string;
  blue: string;
  blueLight: string;
  amberLight: string;
  inputBg: string;
  inputBorder: string;
  errorBg: string;
  errorText: string;
}

const lightColors: ThemeColors = {
  bg: '#f0f9f4',
  cardBg: '#ffffff',
  primary: '#2d8a5e',
  primaryLight: '#e8f5ee',
  primaryHover: '#23704b',
  text: '#1a2e23',
  subtle: '#5c7a68',
  border: '#d1e7dc',
  red: '#c0392b',
  amber: '#e6a817',
  green: '#2d8a5e',
  blue: '#2563eb',
  blueLight: '#eef2ff',
  amberLight: '#fffbeb',
  inputBg: '#fafdfb',
  inputBorder: '#c8ddd2',
  errorBg: '#fef2f2',
  errorText: '#b91c1c',
};

const darkColors: ThemeColors = {
  bg: '#1a1a2e',
  cardBg: '#16213e',
  primary: '#3da06d',
  primaryLight: '#1a2e24',
  primaryHover: '#4cb87d',
  text: '#e0e0e0',
  subtle: '#a0a0b0',
  border: '#2a2a4a',
  red: '#e0555a',
  amber: '#e6a817',
  green: '#3da06d',
  blue: '#4a90d9',
  blueLight: '#1a1a3e',
  amberLight: '#2a2410',
  inputBg: '#1e2a40',
  inputBorder: '#2a2a4a',
  errorBg: '#3a1a1a',
  errorText: '#ef4444',
};

/**
 * Returns the theme-aware color palette.
 * Use inside React components or other hooks.
 */
export function useThemeStyles(): ThemeColors {
  const { isDark } = useTheme();
  return isDark ? darkColors : lightColors;
}
