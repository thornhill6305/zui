import React from "react";
import { Box, Text, useInput } from "ink";

interface Props {
  onClose: () => void;
}

const sections = [
  { title: "--- ZUI Keybindings ---", items: [] as [string, string][] },
  { title: "Navigation", items: [
    ["1-9", "Jump to and view session by index"],
    ["\u2191/\u2193", "Move selection up/down"],
    ["Enter", "View selected session in right pane"],
    ["Tab", "Focus right pane (session output)"],
  ] as [string, string][] },
  { title: "Session Management", items: [
    ["n", "New Claude session (pick project)"],
    ["y", "New YOLO session (auto-accept)"],
    ["k", "Kill selected session"],
    ["x", "Cleanup worktree"],
  ] as [string, string][] },
  { title: "Git & Worktrees", items: [
    ["g", "Toggle lazygit pane"],
    ["w", "Create new worktree"],
  ] as [string, string][] },
  { title: "CLI Commands", items: [
    ["zui <N>", "Attach to Nth session"],
    ["zui ls", "List sessions with indices"],
  ] as [string, string][] },
  { title: "Other", items: [
    ["s", "Open settings"],
    ["r", "Refresh session list"],
    ["h", "This help screen"],
    ["q/Esc", "Quit ZUI"],
  ] as [string, string][] },
];

export function HelpDialog({ onClose }: Props): React.ReactElement {
  useInput((input, key) => {
    if (key.escape || input === "q" || input === "h") onClose();
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
      {sections.map((section) => (
        <Box key={section.title} flexDirection="column">
          <Text bold>{section.title}</Text>
          {section.items.map(([key, desc]) => (
            <Box key={key} gap={1}>
              <Text bold>{"  "}{key.padEnd(12)}</Text>
              <Text>{desc}</Text>
            </Box>
          ))}
          {section.items.length > 0 && <Text> </Text>}
        </Box>
      ))}
      <Text dimColor>Esc/q/h: Close</Text>
    </Box>
  );
}
