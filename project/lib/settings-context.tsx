'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { PublicSettings } from '@/lib/types';

const SettingsContext = createContext<PublicSettings>({});

export function SettingsProvider({ value, children }: { value: PublicSettings; children: ReactNode }) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function usePublicSettings(): PublicSettings {
  return useContext(SettingsContext);
}
