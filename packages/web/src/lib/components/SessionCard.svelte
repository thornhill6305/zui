<script lang="ts">
  import type { Session } from '@zui/core';

  interface Props {
    session: Session;
    selected: boolean;
    onSelect: (name: string) => void;
    onDelete: (name: string) => void;
  }

  let { session, selected, onSelect, onDelete }: Props = $props();

  const statusColors: Record<string, string> = {
    '[WORK]': 'var(--accent)',
    '[WAIT]': 'var(--warning)',
    '[ERR]': 'var(--danger)',
    '[IDLE]': 'var(--text-muted)',
  };

  const agentColors: Record<string, string> = {
    claude: '#8b5cf6',
    codex: '#22c55e',
  };

  function agentLabel(id: string): string {
    if (id === 'codex') return 'Codex';
    return 'Claude';
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    onDelete(session.name);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(session.name);
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="card"
  class:selected
  onclick={() => onSelect(session.name)}
  onkeydown={handleKeydown}
  role="button"
  tabindex="0"
  aria-label="Select session {session.name}"
>
  <div class="card-header">
    <span class="status-dot" style:background={statusColors[session.status]}></span>
    <span class="name">{session.name}</span>
    <button class="delete-btn" onclick={handleDelete} aria-label="Delete session {session.name}">
      ✕
    </button>
  </div>
  <div class="card-meta">
    <span class="agent-badge" style:color={agentColors[session.agent] ?? '#8b5cf6'}>{agentLabel(session.agent)}</span>
    <span class="badge">{session.status}</span>
    <span class="time">{session.running}</span>
    <span class="idle">idle {session.idle}</span>
  </div>
  <div class="preview">{session.preview}</div>
</div>

<style>
  .card {
    display: block;
    width: 100%;
    text-align: left;
    padding: 12px;
    border-radius: 8px;
    background: var(--bg-secondary);
    border: 1px solid transparent;
    transition: all 0.15s ease;
    min-height: 44px;
    cursor: pointer;
  }

  .card:hover {
    background: var(--bg-tertiary);
    border-color: var(--border);
  }

  .card.selected {
    border-color: var(--accent);
    background: rgba(56, 189, 248, 0.08);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .name {
    font-weight: 600;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .delete-btn {
    font-size: 12px;
    color: var(--text-muted);
    padding: 4px 6px;
    border-radius: 4px;
    opacity: 0;
    transition: all 0.15s ease;
    min-width: 28px;
    min-height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card:hover .delete-btn {
    opacity: 1;
  }

  .delete-btn:hover {
    color: var(--danger);
    background: rgba(239, 68, 68, 0.15);
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .agent-badge {
    font-family: monospace;
    font-size: 10px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--bg-tertiary);
  }

  .badge {
    font-family: monospace;
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--bg-tertiary);
  }

  .preview {
    font-size: 11px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
  }
</style>
