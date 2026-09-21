'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { AppSettings } from '@/lib/settings'
import { DEFAULT_SETTINGS } from '@/lib/settings'

interface SettingsContextValue {
  settings: AppSettings
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  updateSetting: async () => {},
})

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => setSettings({ ...DEFAULT_SETTINGS, ...data }))
      .catch(() => {})
  }, [])

  const updateSetting = useCallback(async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => {})
  }, [settings])

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
