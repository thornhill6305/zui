import React from "react";
import { Box, Text } from "ink";

interface HeaderProps {
  webRunning?: boolean;
  webPort?: number;
}

export function Header({ webRunning, webPort }: HeaderProps): React.ReactElement {
  const webIndicator = webRunning ? `  [web :${webPort}]` : "";
  return (
    <Box justifyContent="center" width="100%">
      <Text bold backgroundColor="cyan" color="black">
        {`  zui - Agent Manager${webIndicator}  `}
      </Text>
    </Box>
  );
}
