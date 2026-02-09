import React from "react";
import { Box, Text } from "ink";
import type { Session } from "../types.js";
import { statusColor } from "./theme.js";

interface Props {
  sessions: Session[];
  selectedIndex: number;
}

export function SessionList({ sessions, selectedIndex }: Props): React.ReactElement {
  return (
    <Box flexDirection="column" width="100%">
      <Box paddingLeft={2} gap={1}>
        <Text bold>{"Session".padEnd(30)}</Text>
        <Text bold>{"Status".padEnd(8)}</Text>
        <Text bold>{"Running".padEnd(10)}</Text>
        <Text bold>Preview</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text>{"─".repeat(76)}</Text>
      </Box>
      {sessions.map((session, i) => {
        const selected = i === selectedIndex;
        const marker = selected ? "> " : "  ";
        return (
          <Box key={session.name}>
            <Text bold={selected} inverse={selected}>
              {marker}
              {session.name.padEnd(30).slice(0, 30)}
            </Text>
            <Text bold={selected} inverse={selected} color={statusColor(session.status)}>
              {" "}{session.status.padEnd(8)}
            </Text>
            <Text bold={selected} inverse={selected}>
              {session.running.padEnd(10)}
            </Text>
            <Text bold={selected} inverse={selected} dimColor>
              {session.preview.slice(0, 40)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
