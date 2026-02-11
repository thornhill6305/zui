import { writable } from 'svelte/store';

export const drawerOpen = writable(false);
export const selectedSession = writable<string | null>(null);
export const projectPickerOpen = writable(false);
export const worktreePickerOpen = writable(false);
export const isMobile = writable(false);
