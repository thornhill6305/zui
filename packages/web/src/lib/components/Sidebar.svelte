<script lang="ts">
  import SessionCard from './SessionCard.svelte';
  import { sessions, fetchSessions, deleteSession, startAutoRefresh, stopAutoRefresh } from '$lib/stores/sessions';
  import { selectedSession, projectPickerOpen, isMobile, drawerOpen } from '$lib/stores/ui';
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    onSessionSelect: (name: string) => void;
  }

  let { onSessionSelect }: Props = $props();

  // Issue #13: Adapt refresh interval based on connection type
  onMount(() => {
    const conn = (navigator as any).connection;
    const interval = conn?.effectiveType === '4g' ? 2000 : 5000;
    startAutoRefresh(interval);
  });

  onDestroy(() => {
    stopAutoRefresh();
  });

  function handleSelect(name: string) {
    selectedSession.set(name);
    onSessionSelect(name);
    if ($isMobile) drawerOpen.set(false);
  }

  async function handleDelete(name: string) {
    if (!confirm(`Kill session "${name}"?`)) return;
    await deleteSession(name);
    if ($selectedSession === name) {
      selectedSession.set(null);
    }
  }

  function handleNew() {
    projectPickerOpen.set(true);
  }
</script>

<div class="sidebar">
  <div class="sidebar-header">
    <h1 class="logo">ZUI</h1>
    <button class="new-btn" onclick={handleNew} aria-label="New session">+ New</button>
  </div>

  <div class="session-list">
    {#each $sessions as session (session.name)}
      <SessionCard
        {session}
        selected={$selectedSession === session.name}
        onSelect={handleSelect}
        onDelete={handleDelete}
      />
    {:else}
      <div class="empty">
        <p>No sessions running</p>
        <button class="empty-new-btn" onclick={handleNew}>Create one</button>
      </div>
    {/each}
  </div>
</div>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary);
    overflow: hidden;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    height: var(--topbar-height);
    flex-shrink: 0;
  }

  .logo {
    font-size: 18px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 0.05em;
  }

  .new-btn {
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--accent);
    transition: all 0.15s ease;
    min-height: 36px;
  }

  .new-btn:hover {
    background: var(--accent);
    color: var(--bg-primary);
  }

  .session-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 32px 16px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .empty-new-btn {
    font-size: 13px;
    color: var(--accent);
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid var(--border);
    min-height: 44px;
  }

  .empty-new-btn:hover {
    border-color: var(--accent);
    background: rgba(56, 189, 248, 0.08);
  }
</style>
