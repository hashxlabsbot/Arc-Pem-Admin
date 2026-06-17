import { db } from './db'

export async function logActivity(
  action: string,
  entityType?: string,
  entityId?: string,
  details?: string
) {
  try {
    await db.activityLog.create({
      data: { action, entityType, entityId, details },
    })
  } catch (err) {
    console.warn('[activityLog] write failed:', err)
  }
}
