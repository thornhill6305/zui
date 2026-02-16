import React from "react";
import { Box, Text } from "ink";

interface HeaderProps {
  webRunning?: boolean;
  webPort?: number;
  tailscaleUrl?: string;
  defaultAgent?: string;
}

export function Header({ webRunning, webPort, tailscaleUrl, defaultAgent }: HeaderProps): React.ReactElement {
  const webIndicator = webRunning
    ? tailscaleUrl
      ? `  [${tailscaleUrl}]`
      : `  [web :${webPort}]`
    : "";
  const agentLabel = defaultAgent ? `  [${defaultAgent}]` : "";
  return (
    <Box justifyContent="center" width="100%">
      <Text bold backgroundColor="cyan" color="black">
        {`  zui - Agent Manager${agentLabel}${webIndicator}  `}
      </Text>
    </Box>
  );
}
