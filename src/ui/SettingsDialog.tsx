import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Config } from "../types.js";

interface Props {
  config: Config;
  onSave: (updates: Partial<Config>) => void;
  onCancel: () => void;
}

interface Setting {
  label: string;
  key: keyof Config;
  value: number;
  min: number;
  max: number;
  suffix: string;
}

export function SettingsDialog({ config, onSave, onCancel }: Props): React.ReactElement {
  const [settings, setSettings] = useState<Setting[]>([
    { label: "Right panel width:", key: "layoutRightWidth", value: config.layoutRightWidth, min: 50, max: 90, suffix: "%" },
    { label: "Lazygit height:", key: "layoutLazygitHeight", value: config.layoutLazygitHeight, min: 20, max: 60, suffix: "%" },
    { label: "Refresh interval:", key: "refreshInterval", value: config.refreshInterval, min: 1, max: 10, suffix: "s" },
  ]);
  const [selected, setSelected] = useState(0);

  useInput((_input, key) => {
    if (key.escape) onCancel();
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow) setSelected((s) => Math.min(settings.length - 1, s + 1));
    if (key.rightArrow) {
      setSettings((prev) => prev.map((s, i) =>
        i === selected ? { ...s, value: Math.min(s.max, s.value + 1) } : s
      ));
    }
    if (key.leftArrow) {
      setSettings((prev) => prev.map((s, i) =>
        i === selected ? { ...s, value: Math.max(s.min, s.value - 1) } : s
      ));
    }
    if (key.return) {
      const updates: Partial<Config> = {};
      for (const s of settings) {
        (updates as Record<string, number>)[s.key] = s.value;
      }
      onSave(updates);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
      <Text bold>Settings</Text>
      <Text> </Text>
      {settings.map((s, i) => (
        <Box key={s.key} gap={1}>
          <Text bold={i === selected}>
            {i === selected ? "> " : "  "}
            {s.label.padEnd(20)}
          </Text>
          <Text>[{s.value}]{s.suffix}</Text>
        </Box>
      ))}
      <Text> </Text>
      <Text dimColor>Up/Down: Select | Left/Right: Adjust | Enter: Save | Esc: Cancel</Text>
    </Box>
  );
}
