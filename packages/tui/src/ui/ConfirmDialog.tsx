import React from "react";
import { Box, Text, useInput } from "ink";

interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, onConfirm, onCancel }: Props): React.ReactElement {
  useInput((input, key) => {
    if (input === "y" || input === "Y") onConfirm();
    if (input === "n" || input === "N" || key.escape) onCancel();
  });

  return (
    <Box borderStyle="round" paddingX={2} paddingY={1} justifyContent="center">
      <Text>{message} (y/n)</Text>
    </Box>
  );
}
