import React from "react";
import { Box, Text } from "ink";

export function EmptyState(): React.ReactElement {
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
      <Text bold>No Claude sessions running</Text>
      <Text> </Text>
      <Text>Press 'n' to start a new session</Text>
    </Box>
  );
}
