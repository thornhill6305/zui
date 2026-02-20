import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Project } from "@zui/core";
import { projectDisplayName } from "@zui/core";

interface Props {
  projects: Project[];
  title?: string;
  onSelect: (index: number) => void;
  onCancel: () => void;
  onBrowse?: () => void;
}

export function ProjectPicker({ projects, title = "Select Project", onSelect, onCancel, onBrowse }: Props): React.ReactElement {
  const [selected, setSelected] = useState(0);
  const maxIndex = onBrowse ? projects.length : projects.length - 1;

  useInput((input, key) => {
    if (key.escape) onCancel();
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow) setSelected((s) => Math.min(maxIndex, s + 1));
    if (key.return) {
      if (onBrowse && selected === projects.length) {
        onBrowse();
      } else {
        onSelect(selected);
      }
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
      <Text bold>{title}</Text>
      <Text>Pick a project:</Text>
      <Text> </Text>
      {projects.map((proj, i) => (
        <Box key={proj.path}>
          <Text bold={i === selected}>
            {i === selected ? "> " : "  "}
            {projectDisplayName(proj)}
          </Text>
        </Box>
      ))}
      {onBrowse && (
        <Box>
          <Text bold={selected === projects.length} color={selected === projects.length ? "cyan" : undefined}>
            {selected === projects.length ? "> " : "  "}
            [Browse folder...]
          </Text>
        </Box>
      )}
      <Text> </Text>
      <Text dimColor>Up/Down: Pick | Enter: Select | Esc: Cancel</Text>
    </Box>
  );
}
