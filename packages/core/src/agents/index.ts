// src/agents/index.ts — Provider registry
import type { AgentProvider } from "./types.js";
import { claudeProvider } from "./claude.js";
import { codexProvider } from "./codex.js";

const providers = new Map<string, AgentProvider>();

function register(provider: AgentProvider): void {
  providers.set(provider.id, provider);
}

register(claudeProvider);
register(codexProvider);

export function getProvider(id: string): AgentProvider {
  const provider = providers.get(id);
  if (!provider) throw new Error(`Unknown agent provider: ${id}`);
  return provider;
}

export function allProviders(): AgentProvider[] {
  return [...providers.values()];
}

export type { AgentProvider, AgentConfig, SessionStatus } from "./types.js";
