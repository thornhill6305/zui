<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Terminal from '$lib/components/Terminal.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import ProjectPicker from '$lib/components/ProjectPicker.svelte';
  import WorktreePicker from '$lib/components/WorktreePicker.svelte';
  import MobileDrawer from '$lib/components/MobileDrawer.svelte';
  import KeyboardToolbar from '$lib/components/KeyboardToolbar.svelte';
  import { sessions, projects } from '$lib/stores/sessions';
  import { selectedSession, isMobile, drawerOpen } from '$lib/stores/ui';
  import { activeSession } from '$lib/stores/terminal';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Hydrate stores from SSR data
  $effect(() => {
    sessions.set(data.sessions);
    projects.set(data.projects);
  });

  // Track viewport for responsive layout
  function checkMobile() {
    isMobile.set(window.innerWidth < 768);
  }

  // Shrink app when virtual keyboard opens (mobile)
  let appEl: HTMLElement | undefined = $state();
  let keyboardOpen = $state(false);

  function handleViewportResize() {
    if (!appEl || !window.visualViewport) return;
    appEl.style.height = `${window.visualViewport.height}px`;
    appEl.style.bottom = 'auto';
    keyboardOpen = window.visualViewport.height < window.innerHeight * 0.85;
  }

  let keyboardListeners: Array<() => void> = [];
  let isNativeApp = false;

  onMount(async () => {
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Import xterm.js CSS dynamically (client-only)
    import('@xterm/xterm/css/xterm.css');

    // Native iOS keyboard events — dispatched directly from
    // ZUIBridgeViewController via evaluateJavaScript.  This is the
    // most reliable detection because it doesn't depend on the
    // Capacitor JS bridge being initialised.
    const onNativeShow = () => { keyboardOpen = true; };
    const onNativeHide = () => { keyboardOpen = false; };
    window.addEventListener('native:keyboard-show', onNativeShow);
    window.addEventListener('native:keyboard-hide', onNativeHide);
    keyboardListeners.push(
      () => window.removeEventListener('native:keyboard-show', onNativeShow),
      () => window.removeEventListener('native:keyboard-hide', onNativeHide),
    );

    // Detect Capacitor native environment.
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        isNativeApp = true;
      }
    } catch {
      // Not running in Capacitor — ignore
    }

    // In Capacitor native, also try the Keyboard plugin (belt + suspenders)
    // and hide the default iOS accessory bar.
    if (isNativeApp) {
      try {
        const { Keyboard } = await import('@capacitor/keyboard');
        Keyboard.setAccessoryBarVisible({ isVisible: false });
      } catch {
        // Plugin not available — keyboard events still come from native side.
      }
    } else {
      // Browser fallback — use visualViewport for keyboard detection.
      window.visualViewport?.addEventListener('resize', handleViewportResize);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', checkMobile);
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
      keyboardListeners.forEach((fn) => fn());
    }
  });

  function handleSessionSelect(name: string) {
    selectedSession.set(name);
  }

  function handleCreated(sessionName: string) {
    selectedSession.set(sessionName);
  }

  function openDrawer() {
    drawerOpen.set(true);
  }
</script>

<svelte:head>
  <title>{$selectedSession ? `${$selectedSession} — ZUI` : 'ZUI'}</title>
</svelte:head>

<div class="app" bind:this={appEl}>
  <!-- Desktop sidebar -->
  {#if !$isMobile}
    <aside class="desktop-sidebar">
      <Sidebar onSessionSelect={handleSessionSelect} />
    </aside>
  {/if}

  <!-- Main content -->
  <main class="main">
    {#if $isMobile}
      <div class="mobile-topbar">
        <button class="menu-btn" onclick={openDrawer} aria-label="Open menu">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <rect x="2" y="4" width="16" height="2" rx="1" />
            <rect x="2" y="9" width="16" height="2" rx="1" />
            <rect x="2" y="14" width="16" height="2" rx="1" />
          </svg>
        </button>
        <span class="topbar-title">
          {$selectedSession ?? 'ZUI'}
        </span>
      </div>
    {/if}

    <Terminal session={$selectedSession} />
    {#if keyboardOpen && $isMobile && $activeSession}
      <KeyboardToolbar />
    {/if}
    <StatusBar />
  </main>

  <!-- Mobile drawer -->
  <MobileDrawer onSessionSelect={handleSessionSelect} />

  <!-- Project picker dialog -->
  <ProjectPicker onCreated={handleCreated} />
  <WorktreePicker onCreated={handleCreated} />
</div>

<style>
  .app {
    position: fixed;
    inset: 0;
    display: flex;
    overflow: hidden;
    padding-top: var(--safe-top);
    padding-left: var(--safe-left);
    padding-right: var(--safe-right);
    padding-bottom: var(--safe-bottom);
    background: var(--bg-primary);
  }

  .desktop-sidebar {
    width: var(--sidebar-width);
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    overflow: hidden;
  }

  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .mobile-topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 12px;
    height: var(--topbar-height);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .menu-btn {
    color: var(--text-secondary);
    padding: 8px;
    border-radius: 6px;
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .menu-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .topbar-title {
    font-size: 14px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 767px) {
    .desktop-sidebar {
      display: none;
    }
  }
</style>
