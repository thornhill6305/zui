import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { allProviders } from "@zui/core";

interface Props {
  onSelect: (agentId: string) => void;
  onCancel: () => void;
}

export function AgentPicker({ onSelect, onCancel }: Props): React.ReactElement {
  const providers = allProviders();
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (key.escape || input === "q") {
      onCancel();
      return;
    }
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow) setSelected((s) => Math.min(providers.length - 1, s + 1));
    if (key.return) {
      onSelect(providers[selected]!.id);
      return;
    }
    // Shortcut keys: c for claude, x for codex
    if (input === "c") { onSelect("claude"); return; }
    if (input === "x") { onSelect("codex"); return; }
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
      <Text bold>Select Agent</Text>
      <Text dimColor>[c] Claude  [x] Codex  arrows+Enter</Text>
      <Text> </Text>
      {providers.map((p, i) => {
        const sel = i === selected;
        const marker = sel ? "> " : "  ";
        const color = p.id === "codex" ? "green" : "blue";
        return (
          <Box key={p.id}>
            <Text bold={sel} inverse={sel}>{marker}</Text>
            <Text bold={sel} inverse={sel} color={color}>{p.displayName}</Text>
          </Box>
        );
      })}
      <Text> </Text>
      <Text dimColor>Esc: Cancel</Text>
    </Box>
  );
}
