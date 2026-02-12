import { writable } from 'svelte/store';
import type { XtermManager } from '$lib/terminal/xterm-manager';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export const connectionState = writable<ConnectionState>('disconnected');
export const activeSession = writable<string | null>(null);
export const xtermManager = writable<XtermManager | null>(null);
