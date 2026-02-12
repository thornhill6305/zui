<script lang="ts">
  import { drawerOpen, isMobile } from '$lib/stores/ui';
  import Sidebar from './Sidebar.svelte';

  interface Props {
    onSessionSelect: (name: string) => void;
  }

  let { onSessionSelect }: Props = $props();

  let drawerEl: HTMLElement | undefined = $state();

  // Issue #12: Focus first interactive element when drawer opens
  $effect(() => {
    if ($drawerOpen && drawerEl) {
      const firstFocusable = drawerEl.querySelector<HTMLElement>('button, a, input');
      firstFocusable?.focus();
    }
  });

  // Touch handling for swipe-to-close
  let touchStartX = 0;
  let touchCurrentX = 0;
  let swiping = false;

  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0]!.clientX;
    touchCurrentX = touchStartX;
    swiping = true;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!swiping) return;
    touchCurrentX = e.touches[0]!.clientX;
  }

  function handleTouchEnd() {
    if (!swiping) return;
    swiping = false;
    const delta = touchCurrentX - touchStartX;
    // Swipe left to close
    if (delta < -80) {
      drawerOpen.set(false);
    }
  }

  function handleOverlayClick() {
    drawerOpen.set(false);
  }

  function handleOverlayKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') drawerOpen.set(false);
  }
</script>

{#if $isMobile && $drawerOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="drawer-overlay"
    role="dialog"
    aria-modal="true"
    onclick={handleOverlayClick}
    onkeydown={handleOverlayKeydown}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="drawer"
      bind:this={drawerEl}
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      ontouchend={handleTouchEnd}
    >
      <Sidebar {onSessionSelect} />
    </div>
  </div>
{/if}

<style>
  .drawer-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 50;
    animation: fadeIn 0.2s ease;
  }

  .drawer {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(300px, 85vw);
    padding-top: var(--safe-top);
    padding-bottom: var(--safe-bottom);
    padding-left: var(--safe-left);
    background: var(--bg-primary);
    border-right: 1px solid var(--border);
    animation: slideIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideIn {
    from { transform: translateX(-100%); }
    to { transform: translateX(0); }
  }
</style>
