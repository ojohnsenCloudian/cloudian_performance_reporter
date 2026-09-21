export interface AppSettings {
  throughputUnit: 'MB/s' | 'GB/s'
}

export const DEFAULT_SETTINGS: AppSettings = {
  throughputUnit: 'MB/s',
}
