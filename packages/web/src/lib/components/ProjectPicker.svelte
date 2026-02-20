<script lang="ts">
  import type { Project } from '@zui/core';
  import { projects, fetchProjects, createSession, fetchBrowseSuggestions } from '$lib/stores/sessions';
  import { projectPickerOpen } from '$lib/stores/ui';

  interface Props {
    onCreated?: (sessionName: string) => void;
  }

  let { onCreated }: Props = $props();
  let search = $state('');
  let yolo = $state(false);
  let agent = $state('claude');
  let creating = $state(false);
  let browsing = $state(false);
  let browsePath = $state('');
  let suggestions = $state<string[]>([]);
  let browseError = $state('');

  let filtered = $derived(
    $projects.filter((p) => {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q);
    }),
  );

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if ($projectPickerOpen) {
      fetchProjects();
      search = '';
      yolo = false;
      agent = 'claude';
      browsing = false;
      browsePath = '';
      suggestions = [];
      browseError = '';
    }
  });

  $effect(() => {
    if (!browsing) return;
    const path = browsePath;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      suggestions = await fetchBrowseSuggestions(path || '~/');
    }, 150);
  });

  function close() {
    projectPickerOpen.set(false);
  }

  async function pick(project: Project) {
    creating = true;
    const sessionName = await createSession(project.path, yolo, agent);
    creating = false;
    close();
    if (sessionName) onCreated?.(sessionName);
  }

  async function submitBrowsePath() {
    const path = browsePath.trim();
    if (!path) return;
    creating = true;
    browseError = '';
    const sessionName = await createSession(path, yolo, agent);
    creating = false;
    if (sessionName) {
      close();
      onCreated?.(sessionName);
    } else {
      browseError = 'Invalid directory or session failed to create';
    }
  }

  function pickSuggestion(path: string) {
    browsePath = path + '/';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (browsing) {
        browsing = false;
      } else {
        close();
      }
    }
  }
</script>

{#if $projectPickerOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onclick={close} onkeydown={handleKeydown}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="dialog" onclick={(e) => e.stopPropagation()} onkeydown={handleKeydown}>
      <div class="dialog-header">
        <h2>{browsing ? 'Browse Folder' : 'New Session'}</h2>
        <button class="close-btn" onclick={close}>✕</button>
      </div>

      {#if browsing}
        <div class="browse-input-row">
          <!-- svelte-ignore a11y_autofocus -->
          <input
            type="text"
            class="search"
            placeholder="Enter folder path…"
            bind:value={browsePath}
            autofocus
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitBrowsePath();
              }
            }}
          />
        </div>

        <div class="agent-select">
          <label class="agent-label">Agent:</label>
          <select bind:value={agent}>
            <option value="claude">Claude Code</option>
            <option value="codex">Codex CLI</option>
          </select>
        </div>

        <label class="yolo-toggle">
          <input type="checkbox" bind:checked={yolo} />
          <span>YOLO mode (auto-approve)</span>
        </label>

        {#if browseError}
          <div class="browse-error">{browseError}</div>
        {/if}

        <div class="project-list">
          {#each suggestions as path}
            <button
              class="project-item"
              onclick={() => pickSuggestion(path)}
              disabled={creating}
            >
              <span class="project-name">{path.split('/').pop()}/</span>
              <span class="project-path">{path}</span>
            </button>
          {:else}
            <div class="empty">No directories found</div>
          {/each}
        </div>

        <div class="browse-footer">
          <button class="back-btn" onclick={() => (browsing = false)}>Back</button>
          <button class="submit-btn" onclick={submitBrowsePath} disabled={creating || !browsePath.trim()}>
            {creating ? 'Creating…' : 'Launch'}
          </button>
        </div>
      {:else}
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          class="search"
          placeholder="Search projects…"
          bind:value={search}
          autofocus
        />

        <div class="agent-select">
          <label class="agent-label">Agent:</label>
          <select bind:value={agent}>
            <option value="claude">Claude Code</option>
            <option value="codex">Codex CLI</option>
          </select>
        </div>

        <label class="yolo-toggle">
          <input type="checkbox" bind:checked={yolo} />
          <span>YOLO mode (auto-approve)</span>
        </label>

        <div class="project-list">
          {#each filtered as project}
            <button
              class="project-item"
              onclick={() => pick(project)}
              disabled={creating}
            >
              <span class="project-name">{project.name}</span>
              {#if project.branch && project.branch !== project.name}
                <span class="project-branch">{project.branch}</span>
              {/if}
              <span class="project-path">{project.path}</span>
              {#if project.isWorktree}
                <span class="wt-badge">worktree</span>
              {/if}
            </button>
          {:else}
            <div class="empty">No projects found</div>
          {/each}
          <button
            class="project-item browse-item"
            onclick={() => (browsing = true)}
          >
            <span class="browse-label">Browse folder…</span>
          </button>
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

  .browse-input-row {
    display: flex;
    align-items: center;
  }

  .browse-input-row .search {
    flex: 1;
  }

  .agent-select {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 16px 4px;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .agent-label {
    font-weight: 600;
    font-size: 13px;
  }

  .agent-select select {
    padding: 4px 8px;
    border-radius: 6px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    font-size: 13px;
  }

  .agent-select select:focus {
    border-color: var(--accent);
    outline: none;
  }

  .yolo-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 16px 8px;
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

  .project-item:disabled {
    opacity: 0.5;
    cursor: wait;
  }

  .project-name {
    font-weight: 600;
    font-size: 13px;
  }

  .project-branch {
    font-size: 11px;
    color: var(--accent);
    font-family: monospace;
  }

  .project-path {
    font-size: 11px;
    color: var(--text-muted);
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .wt-badge {
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--bg-tertiary);
    color: var(--text-muted);
  }

  .empty {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }

  .browse-item {
    border-top: 1px solid var(--border);
    margin-top: 4px;
    padding-top: 12px;
  }

  .browse-label {
    font-size: 13px;
    color: var(--accent);
    font-weight: 600;
  }

  .browse-error {
    padding: 4px 16px;
    font-size: 12px;
    color: var(--error, #e55);
  }

  .browse-footer {
    display: flex;
    justify-content: space-between;
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    gap: 8px;
  }

  .back-btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-secondary);
    min-height: 44px;
  }

  .back-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .submit-btn {
    padding: 8px 20px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    background: var(--accent);
    color: var(--bg-primary);
    min-height: 44px;
  }

  .submit-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
