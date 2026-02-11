<script lang="ts">
  import { connectionState, activeSession } from '$lib/stores/terminal';

  const stateLabels: Record<string, string> = {
    disconnected: 'Disconnected',
    connecting: 'Connecting…',
    connected: 'Connected',
    reconnecting: 'Reconnecting…',
  };

  const stateColors: Record<string, string> = {
    disconnected: 'var(--text-muted)',
    connecting: 'var(--warning)',
    connected: 'var(--success)',
    reconnecting: 'var(--warning)',
  };
</script>

<div class="status-bar">
  <div class="left">
    {#if $activeSession}
      <span class="session-name">{$activeSession}</span>
    {:else}
      <span class="no-session">No session selected</span>
    {/if}
  </div>
  <div class="right">
    <span class="dot" style:background={stateColors[$connectionState]}></span>
    <span class="label">{stateLabels[$connectionState]}</span>
  </div>
</div>

<style>
  .status-bar {
    height: var(--status-bar-height);
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    font-size: 12px;
    flex-shrink: 0;
  }

  .left {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
  }

  .session-name {
    font-family: monospace;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .no-session {
    color: var(--text-muted);
  }

  .right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .label {
    color: var(--text-muted);
  }
</style>
