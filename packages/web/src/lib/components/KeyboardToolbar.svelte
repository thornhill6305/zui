<script lang="ts">
  import { xtermManager } from '$lib/stores/terminal';

  const buttons: Array<{ label: string; seq: string }> = [
    { label: 'Esc', seq: '\x1b' },
    { label: 'Tab', seq: '\t' },
    { label: '\u2191', seq: '\x1b[A' },
    { label: '\u2193', seq: '\x1b[B' },
    { label: '\u2190', seq: '\x1b[D' },
    { label: '\u2192', seq: '\x1b[C' },
    { label: '^C', seq: '\x03' },
  ];

  function send(seq: string) {
    $xtermManager?.sendData(seq);
    $xtermManager?.focus();
  }

  function preventFocusSteal(ev: Event) {
    ev.preventDefault();
  }

  function dismissKeyboard() {
    try {
      (window as any).webkit?.messageHandlers?.keyboard?.postMessage('hide');
    } catch {
      (document.activeElement as HTMLElement)?.blur();
    }
  }
</script>

<div class="keyboard-toolbar" role="toolbar" aria-label="Terminal quick actions">
  {#each buttons as btn}
    <button
      class="toolbar-btn"
      ontouchstart={preventFocusSteal}
      onmousedown={preventFocusSteal}
      onclick={() => send(btn.seq)}
    >
      {btn.label}
    </button>
  {/each}
  <button
    class="toolbar-btn dismiss-btn"
    ontouchstart={preventFocusSteal}
    onmousedown={preventFocusSteal}
    onclick={dismissKeyboard}
    aria-label="Dismiss keyboard"
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="1" width="14" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none" />
      <path d="M4.5 12.5 8 15l3.5-2.5" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</div>

<style>
  .keyboard-toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    height: 40px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
    touch-action: manipulation;
  }

  .toolbar-btn {
    flex: 1;
    height: 32px;
    min-width: 0;
    border-radius: 5px;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }

  .toolbar-btn:active {
    background: var(--accent);
    color: var(--bg-primary);
  }
</style>
