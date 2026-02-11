import React from "react";
import { Box, Text } from "ink";

export function Footer(): React.ReactElement {
  return (
    <Box justifyContent="center" width="100%">
      <Text backgroundColor="cyan" color="black">
        {" 1-9:Jump Ent:View g:Git Tab:Pane n:New y:YOLO w:Tree s:Set h:Help k:Kill q:Quit Alt:Remote "}
      </Text>
    </Box>
  );
}
