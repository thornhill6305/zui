<script lang="ts">
  import type { Project } from '@zui/core';
  import { projects, fetchProjects, createWorktreeAndSession } from '$lib/stores/sessions';
  import { worktreePickerOpen } from '$lib/stores/ui';

  interface Props {
    onCreated?: (sessionName: string) => void;
  }

  let { onCreated }: Props = $props();
  let step = $state<'repo' | 'branch'>('repo');
  let search = $state('');
  let branch = $state('feat/');
  let yolo = $state(false);
  let creating = $state(false);
  let error = $state<string | null>(null);
  let selectedRepo = $state<Project | null>(null);

  let repos = $derived(
    $projects.filter((p) => !p.isWorktree).filter((p) => {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q);
    }),
  );

  $effect(() => {
    if ($worktreePickerOpen) {
      fetchProjects();
      step = 'repo';
      search = '';
      branch = 'feat/';
      yolo = false;
      error = null;
      selectedRepo = null;
    }
  });

  function close() {
    worktreePickerOpen.set(false);
  }

  function pickRepo(project: Project) {
    selectedRepo = project;
    search = '';
    step = 'branch';
  }

  async function create() {
    if (!selectedRepo || !branch.trim()) return;
    creating = true;
    error = null;
    try {
      const sessionName = await createWorktreeAndSession(selectedRepo.path, branch.trim(), yolo);
      creating = false;
      close();
      if (sessionName) onCreated?.(sessionName);
    } catch (err) {
      creating = false;
      error = err instanceof Error ? err.message : 'Failed to create worktree';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (step === 'branch') {
        step = 'repo';
      } else {
        close();
      }
    }
  }
</script>

{#if $worktreePickerOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onclick={close} onkeydown={handleKeydown}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="dialog" onclick={(e) => e.stopPropagation()} onkeydown={handleKeydown}>
      <div class="dialog-header">
        <h2>{step === 'repo' ? 'New Worktree — Select Repo' : `Worktree in ${selectedRepo?.name}`}</h2>
        <button class="close-btn" onclick={close}>✕</button>
      </div>

      {#if step === 'repo'}
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          class="search"
          placeholder="Search repositories…"
          bind:value={search}
          autofocus
        />

        <div class="project-list">
          {#each repos as project}
            <button
              class="project-item"
              onclick={() => pickRepo(project)}
            >
              <span class="project-name">{project.name}</span>
              <span class="project-path">{project.path}</span>
            </button>
          {:else}
            <div class="empty">No repositories found</div>
          {/each}
        </div>
      {:else}
        <div class="branch-form">
          <label class="field-label" for="wt-branch-input">Branch name</label>
          <!-- svelte-ignore a11y_autofocus -->
          <input
            id="wt-branch-input"
            type="text"
            class="search"
            placeholder="feat/my-feature"
            bind:value={branch}
            autofocus
          />

          <label class="yolo-toggle">
            <input type="checkbox" bind:checked={yolo} />
            <span>YOLO mode (auto-approve)</span>
          </label>

          {#if error}
            <div class="error">{error}</div>
          {/if}

          <div class="actions">
            <button class="back-btn" onclick={() => { step = 'repo'; }} disabled={creating}>Back</button>
            <button
              class="create-btn"
              onclick={create}
              disabled={creating || !branch.trim()}
            >
              {creating ? 'Creating…' : 'Create Worktree'}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 16px;
  }

  .dialog {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 100%;
    max-width: 480px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--border);
  }

  h2 {
    font-size: 16px;
    font-weight: 600;
  }

  .close-btn {
    font-size: 14px;
    color: var(--text-muted);
    padding: 6px 8px;
    border-radius: 6px;
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .search {
    margin: 12px 16px 8px;
    padding: 8px 12px;
    border-radius: 6px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    font-size: 14px;
  }

  .search:focus {
    border-color: var(--accent);
    outline: none;
  }

  .project-list {
    overflow-y: auto;
    padding: 0 8px 8px;
    flex: 1;
  }

  .project-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    width: 100%;
    text-align: left;
    padding: 10px 8px;
    border-radius: 6px;
    transition: background 0.1s ease;
    min-height: 44px;
  }

  .project-item:hover {
    background: var(--bg-tertiary);
  }

  .project-name {
    font-weight: 600;
    font-size: 13px;
  }

  .project-path {
    font-size: 11px;
    color: var(--text-muted);
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .branch-form {
    padding: 8px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .branch-form .search {
    margin: 0;
  }

  .yolo-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    min-height: 44px;
  }

  .yolo-toggle input {
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
  }

  .error {
    font-size: 13px;
    color: #ef4444;
    padding: 8px;
    border-radius: 6px;
    background: rgba(239, 68, 68, 0.1);
  }

  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding-top: 8px;
  }

  .back-btn {
    font-size: 13px;
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid var(--border);
    color: var(--text-secondary);
    min-height: 44px;
  }

  .back-btn:hover {
    background: var(--bg-tertiary);
  }

  .create-btn {
    font-size: 13px;
    font-weight: 600;
    padding: 8px 16px;
    border-radius: 6px;
    background: var(--accent);
    color: var(--bg-primary);
    min-height: 44px;
  }

  .create-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .create-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .empty {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
