import React from "react";
import { Box, Text, useStdout } from "ink";
import type { Session } from "../types.js";
import { statusColor } from "./theme.js";

interface Props {
  sessions: Session[];
  selectedIndex: number;
}

export function SessionList({ sessions, selectedIndex }: Props): React.ReactElement {
  const { stdout } = useStdout();
  const cols = stdout.columns || 80;

  // All widths are explicit — no bare inline Text elements between columns.
  // index(3) + marker(2) + name + status(7) + running(9) + preview(rest)
  const indexW = 3;
  const markerW = 2;
  const statusW = 7; // " [WAIT]" = 7
  const runningW = 9; // " 1h 23m" max ~9
  const fixedW = indexW + markerW + statusW + runningW;
  const flexW = Math.max(cols - fixedW, 16);
  const nameW = Math.min(30, Math.floor(flexW * 0.45));
  const previewW = flexW - nameW;

  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden">
      <Box overflow="hidden">
        <Box width={indexW} flexShrink={0}>
          <Text bold> #</Text>
        </Box>
        <Box width={markerW + nameW} flexShrink={0} paddingLeft={2}>
          <Text bold>Session</Text>
        </Box>
        <Box width={statusW} flexShrink={0}>
          <Text bold> Status</Text>
        </Box>
        <Box width={runningW} flexShrink={0}>
          <Text bold> Running</Text>
        </Box>
        <Box width={previewW} flexShrink={0} overflow="hidden">
          <Text bold> Preview</Text>
        </Box>
      </Box>
      <Box paddingLeft={2} overflow="hidden">
        <Text>{"─".repeat(Math.max(cols - 4, 10))}</Text>
      </Box>
      {sessions.map((session, i) => {
        const sel = i === selectedIndex;
        const marker = sel ? "> " : "  ";
        const num = String(i + 1).padStart(2);
        return (
          <Box key={session.name} overflow="hidden">
            <Box width={indexW} flexShrink={0}>
              <Text bold={sel} inverse={sel} dimColor={!sel}>{num} </Text>
            </Box>
            <Box width={markerW} flexShrink={0}>
              <Text bold={sel} inverse={sel}>{marker}</Text>
            </Box>
            <Box width={nameW} flexShrink={0} overflow="hidden">
              <Text bold={sel} inverse={sel} wrap="truncate">
                {session.name}
              </Text>
            </Box>
            <Box width={statusW} flexShrink={0} overflow="hidden">
              <Text bold={sel} inverse={sel} color={statusColor(session.status)} wrap="truncate">
                {" "}{session.status}
              </Text>
            </Box>
            <Box width={runningW} flexShrink={0} overflow="hidden">
              <Text bold={sel} inverse={sel} wrap="truncate">
                {" "}{session.running}
              </Text>
            </Box>
            <Box width={previewW} flexShrink={0} overflow="hidden">
              <Text bold={sel} inverse={sel} dimColor wrap="truncate">
                {" "}{session.preview}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
