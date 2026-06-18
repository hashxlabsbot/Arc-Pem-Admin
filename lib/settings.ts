import { db } from './db'

// Keys for the generic `Setting` key/value store.
export const SETTING_KEYS = {
  /**
   * "true"/"false" — early-access mode. When "true", new buyers pay now but are
   * flagged `earlyAccess` and their license key is held until the admin ships the
   * product. When "false", it's the normal flow (license issued the usual way).
   * Registration is NOT gated either way.
   */
  earlyAccessOpen: 'earlyAccessOpen',
} as const

/** Read a raw setting value, or null if unset. */
export async function getSetting(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } })
  return row?.value ?? null
}

/** Read a boolean setting, falling back to `fallback` when unset. */
export async function getBoolSetting(key: string, fallback = false): Promise<boolean> {
  const value = await getSetting(key)
  if (value === null) return fallback
  return value === 'true'
}

/** Create or update a setting. */
export async function setSetting(key: string, value: string) {
  return db.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}

/**
 * Whether early-access mode is on (buyers pay now, license shipped later).
 * Defaults to OFF — normal flow until the admin turns it on for the event.
 */
export async function isEarlyAccessOpen(): Promise<boolean> {
  return getBoolSetting(SETTING_KEYS.earlyAccessOpen, false)
}
