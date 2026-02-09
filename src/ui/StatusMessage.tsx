import React from "react";
import { Box, Text } from "ink";

interface Props {
  message: string;
}

export function StatusMessage({ message }: Props): React.ReactElement | null {
  if (!message) return null;
  const isError = message.startsWith("Error");
  return (
    <Box paddingLeft={2}>
      <Text bold inverse={isError}>{message}</Text>
    </Box>
  );
}
