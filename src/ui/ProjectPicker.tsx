import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Project } from "../types.js";
import { projectDisplayName } from "../types.js";

interface Props {
  projects: Project[];
  title?: string;
  onSelect: (index: number) => void;
  onCancel: () => void;
}

export function ProjectPicker({ projects, title = "Select Project", onSelect, onCancel }: Props): React.ReactElement {
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (key.escape) onCancel();
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow) setSelected((s) => Math.min(projects.length - 1, s + 1));
    if (key.return) onSelect(selected);
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
      <Text> </Text>
      <Text dimColor>Up/Down: Pick | Enter: Select | Esc: Cancel</Text>
    </Box>
  );
}
