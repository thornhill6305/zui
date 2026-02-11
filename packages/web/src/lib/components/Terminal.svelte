<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { XtermManager } from '$lib/terminal/xterm-manager';

  interface Props {
    session: string | null;
  }

  let { session }: Props = $props();

  let containerEl: HTMLElement | undefined = $state();
  let manager: XtermManager | null = null;
  let XtermManagerClass: typeof XtermManager | null = null;

  // Dynamically import xterm (browser-only, crashes during SSR)
  onMount(async () => {
    const mod = await import('$lib/terminal/xterm-manager');
    XtermManagerClass = mod.XtermManager;
  });

  // Track the current session and reconnect when it changes
  $effect(() => {
    if (!containerEl || !XtermManagerClass) return;

    if (session) {
      manager = new XtermManagerClass();
      manager.open(containerEl, session);
      manager.focus();
    }

    return () => {
      manager?.dispose();
      manager = null;
    };
  });
</script>

<div class="terminal-wrapper">
  {#if session}
    <div class="terminal-container" bind:this={containerEl}></div>
  {:else}
    <div class="placeholder">
      <div class="placeholder-content">
        <span class="placeholder-icon">⚡</span>
        <p>Select a session to connect</p>
        <p class="hint">Or create a new one from the sidebar</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .terminal-wrapper {
    flex: 1;
    display: flex;
    overflow: hidden;
    background: var(--bg-primary);
  }

  .terminal-container {
    flex: 1;
    padding: 4px;
  }

  .terminal-container :global(.xterm) {
    height: 100%;
  }

  .terminal-container :global(.xterm-viewport) {
    overflow-y: auto !important;
  }

  .placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .placeholder-content {
    text-align: center;
    color: var(--text-muted);
  }

  .placeholder-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 16px;
  }

  .placeholder-content p {
    font-size: 16px;
    margin-bottom: 8px;
  }

  .hint {
    font-size: 13px !important;
    color: var(--text-muted);
  }
</style>
