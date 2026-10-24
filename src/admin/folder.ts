// Continuous backup to a folder on your computer (File System Access API).
// Works in Chrome and Edge on desktop. Elsewhere the Studio still keeps
// version history in the browser and offers downloads.
//
// Folder layout:
//   <slug>.md                         the essay as it is right now (same format as the repo)
//   new-essay.md                      a new essay before its first save
//   history/<slug>/<date_time>.md     timestamped copies
import { kvGet, kvSet, kvDelete } from './backup';

type Handle = any; // FileSystemDirectoryHandle; typed loosely for older TS DOM libs.

export type FolderStatus = 'unsupported' | 'none' | 'prompt' | 'granted' | 'denied';

let handle: Handle | null = null;
let status: FolderStatus = 'none';
const listeners = new Set<() => void>();

export const folderSupported = () => typeof (window as any).showDirectoryPicker === 'function';

function notify() {
  listeners.forEach((l) => l());
}

export function onFolderChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function folderName(): string {
  return handle?.name ?? '';
}

export function folderStatus(): FolderStatus {
  return folderSupported() ? status : 'unsupported';
}

/** Load the remembered folder (no prompt). Call once at startup. */
export async function initFolder() {
  if (!folderSupported()) return;
  try {
    handle = (await kvGet<Handle>('folder')) ?? null;
  } catch {
    handle = null;
  }
  status = handle ? await permission(false) : 'none';
  notify();
}

async function permission(ask: boolean): Promise<FolderStatus> {
  if (!handle) return 'none';
  try {
    const opts = { mode: 'readwrite' };
    let p = await handle.queryPermission?.(opts);
    if (p !== 'granted' && ask) p = await handle.requestPermission?.(opts);
    return p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'prompt';
  }
}

/** Let the user pick a folder. Must run from a click. */
export async function chooseFolder(): Promise<boolean> {
  try {
    const picked = await (window as any).showDirectoryPicker({ id: 'studio-backup', mode: 'readwrite' });
    handle = picked;
    try {
      await kvSet('folder', picked);
    } catch {
      // Keep it for this session even if it can't be remembered.
    }
    status = await permission(true);
    notify();
    return status === 'granted';
  } catch {
    return false; // cancelled
  }
}

/** Re-allow writing after a reload (browsers ask again each session). Must run from a click. */
export async function resumeFolder(): Promise<boolean> {
  status = await permission(true);
  notify();
  return status === 'granted';
}

export async function forgetFolder() {
  handle = null;
  status = 'none';
  try {
    await kvDelete('folder');
  } catch {}
  notify();
}

async function writeFile(parts: string[], text: string) {
  let dir = handle;
  for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create: true });
  const file = await dir.getFileHandle(parts[parts.length - 1], { create: true });
  const w = await file.createWritable();
  await w.write(text);
  await w.close();
}

function safe(name: string) {
  return name.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 100) || 'essay';
}

/** Write the current text of an essay. Returns false if the folder isn't usable. */
export async function writeLive(name: string, text: string): Promise<boolean> {
  if (folderStatus() !== 'granted' || !handle) return false;
  try {
    await writeFile([`${safe(name)}.md`], text);
    return true;
  } catch (e) {
    console.warn('Folder backup failed', e);
    status = await permission(false);
    notify();
    return false;
  }
}

/** Write a timestamped copy into history/<name>/. */
export async function writeHistory(name: string, stampText: string, text: string): Promise<boolean> {
  if (folderStatus() !== 'granted' || !handle) return false;
  try {
    await writeFile(['history', safe(name), `${stampText}.md`], text);
    return true;
  } catch (e) {
    console.warn('Folder history backup failed', e);
    return false;
  }
}
