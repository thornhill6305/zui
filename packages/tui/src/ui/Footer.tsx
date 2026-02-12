import React from "react";
import { Box, Text } from "ink";

interface FooterProps {
  webRunning?: boolean;
}

export function Footer({ webRunning }: FooterProps): React.ReactElement {
  const webLabel = webRunning ? "v:Web\u2713" : "v:Web";
  return (
    <Box justifyContent="center" width="100%">
      <Text backgroundColor="cyan" color="black">
        {` 1-9:Jump Ent:View g:Git Tab:Pane n:New y:YOLO w:Tree ${webLabel} s:Set h:Help k:Kill q:Quit `}
      </Text>
    </Box>
  );
}
