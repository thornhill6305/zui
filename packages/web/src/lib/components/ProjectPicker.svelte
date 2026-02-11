<script lang="ts">
  import type { Project } from '@zui/core';
  import { projects, fetchProjects, createSession } from '$lib/stores/sessions';
  import { projectPickerOpen } from '$lib/stores/ui';

  interface Props {
    onCreated?: (sessionName: string) => void;
  }

  let { onCreated }: Props = $props();
  let search = $state('');
  let yolo = $state(false);
  let creating = $state(false);

  let filtered = $derived(
    $projects.filter((p) => {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q);
    }),
  );

  $effect(() => {
    if ($projectPickerOpen) {
      fetchProjects();
      search = '';
      yolo = false;
    }
  });

  function close() {
    projectPickerOpen.set(false);
  }

  async function pick(project: Project) {
    creating = true;
    const sessionName = await createSession(project.path, yolo);
    creating = false;
    close();
    if (sessionName) onCreated?.(sessionName);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
</script>

{#if $projectPickerOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onclick={close} onkeydown={handleKeydown}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="dialog" onclick={(e) => e.stopPropagation()} onkeydown={handleKeydown}>
      <div class="dialog-header">
        <h2>New Session</h2>
        <button class="close-btn" onclick={close}>✕</button>
      </div>

      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="text"
        class="search"
        placeholder="Search projects…"
        bind:value={search}
        autofocus
      />

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
      </div>
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
</style>
