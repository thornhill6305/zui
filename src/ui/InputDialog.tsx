import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

interface Props {
  title: string;
  prompt: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function InputDialog({ title, prompt, defaultValue = "", onSubmit, onCancel }: Props): React.ReactElement {
  const [value, setValue] = useState(defaultValue);

  useInput((_input, key) => {
    if (key.escape) onCancel();
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
      <Text bold>{title}</Text>
      <Box>
        <Text>{prompt} </Text>
        <TextInput value={value} onChange={setValue} onSubmit={() => onSubmit(value)} />
      </Box>
    </Box>
  );
}
