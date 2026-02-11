import React from "react";
import { Box, Text } from "ink";

export function Header(): React.ReactElement {
  return (
    <Box justifyContent="center" width="100%">
      <Text bold backgroundColor="cyan" color="black">
        {"  zui - Agent Manager  "}
      </Text>
    </Box>
  );
}
