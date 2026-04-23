import { createContext, useContext } from 'react';

export interface ColorModeCtx {
  toggle: () => void;
  mode: 'light' | 'dark';
}

export const ColorModeContext = createContext<ColorModeCtx>({
  toggle: () => {},
  mode: 'dark',
});

export function useColorMode() {
  return useContext(ColorModeContext);
}
