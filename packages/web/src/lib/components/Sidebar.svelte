<script lang="ts">
  import SessionCard from './SessionCard.svelte';
  import { sessions, fetchSessions, fetchProjects, deleteSession, removeWorktree, startAutoRefresh, stopAutoRefresh, projects } from '$lib/stores/sessions';
  import { selectedSession, projectPickerOpen, worktreePickerOpen, isMobile, drawerOpen } from '$lib/stores/ui';
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    onSessionSelect: (name: string) => void;
  }

  let { onSessionSelect }: Props = $props();

  let worktrees = $derived($projects.filter((p) => p.isWorktree));

  // Issue #13: Adapt refresh interval based on connection type
  onMount(() => {
    const conn = (navigator as any).connection;
    const interval = conn?.effectiveType === '4g' ? 2000 : 5000;
    startAutoRefresh(interval);
    fetchProjects();
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

  function handleNewWorktree() {
    worktreePickerOpen.set(true);
  }

  async function handleDeleteWorktree(wt: typeof worktrees[0]) {
    if (!confirm(`Remove worktree "${wt.name}" and delete branch "${wt.branch}"?`)) return;
    await removeWorktree(wt.parentRepo, wt.path, wt.branch);
  }
</script>

<div class="sidebar">
  <div class="sidebar-header">
    <h1 class="logo">ZUI</h1>
    <div class="header-actions">
      <button class="new-btn" onclick={handleNew} aria-label="New session">+ New</button>
      <button class="new-btn wt-btn" onclick={handleNewWorktree} aria-label="New worktree">+ WT</button>
    </div>
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

  {#if worktrees.length > 0}
    <div class="worktree-section">
      <div class="section-label">Worktrees</div>
      {#each worktrees as wt (wt.path)}
        <div class="worktree-item">
          <div class="wt-info">
            <span class="wt-name">{wt.name}</span>
            <span class="wt-branch">{wt.branch}</span>
          </div>
          <button class="wt-delete" onclick={() => handleDeleteWorktree(wt)} aria-label="Remove worktree">✕</button>
        </div>
      {/each}
    </div>
  {/if}
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

  .header-actions {
    display: flex;
    gap: 6px;
  }

  .wt-btn {
    font-size: 12px;
    padding: 6px 8px;
  }

  .worktree-section {
    border-top: 1px solid var(--border);
    padding: 8px;
    flex-shrink: 0;
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 4px 8px 8px;
  }

  .worktree-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    border-radius: 6px;
    gap: 8px;
  }

  .worktree-item:hover {
    background: var(--bg-tertiary);
  }

  .wt-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .wt-name {
    font-size: 12px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .wt-branch {
    font-size: 11px;
    color: var(--accent);
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .wt-delete {
    font-size: 11px;
    color: var(--text-muted);
    padding: 4px 6px;
    border-radius: 4px;
    flex-shrink: 0;
    min-width: 28px;
    min-height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .wt-delete:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }
</style>
