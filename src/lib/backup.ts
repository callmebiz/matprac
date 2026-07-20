// Must match the `name` each store's zustand `persist` middleware uses.
const BACKUP_KEYS = ['matprac-stats', 'matprac-settings', 'matprac-question-bank', 'matprac-chats']

interface BackupFile {
  version: 1
  exportedAt: string
  data: Record<string, unknown>
}

export function exportBackup(): void {
  const data: Record<string, unknown> = {}
  for (const key of BACKUP_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw !== null) data[key] = JSON.parse(raw)
  }
  const payload: BackupFile = { version: 1, exportedAt: new Date().toISOString(), data }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `matprac-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Overwrites the relevant localStorage keys in place. Caller is responsible for reloading afterward. */
export async function importBackup(file: File): Promise<void> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("That file isn't valid JSON.")
  }

  if (!parsed || typeof parsed !== 'object' || !('data' in parsed) || typeof (parsed as BackupFile).data !== 'object') {
    throw new Error("This doesn't look like a MatPrac backup file.")
  }

  const { data } = parsed as BackupFile
  for (const key of BACKUP_KEYS) {
    if (key in data) {
      localStorage.setItem(key, JSON.stringify(data[key]))
    }
  }
}
