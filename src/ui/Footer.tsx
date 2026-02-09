import React from "react";
import { Box, Text } from "ink";

export function Footer(): React.ReactElement {
  return (
    <Box justifyContent="center" width="100%">
      <Text backgroundColor="cyan" color="black">
        {" Ent:View g:Git Tab:Pane n:New y:YOLO w:Tree s:Set h:Help k:Kill x:Clean q:Quit "}
      </Text>
    </Box>
  );
}
