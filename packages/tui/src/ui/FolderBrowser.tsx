import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { readdirSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import { homedir } from "node:os";

interface Props {
  title?: string;
  defaultValue?: string;
  onSubmit: (path: string) => void;
  onCancel: () => void;
}

function expandHome(p: string): string {
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  if (p === "~") return homedir();
  return p;
}

function getDirectorySuggestions(input: string): string[] {
  const expanded = expandHome(input);
  const resolved = resolve(expanded);

  try {
    let parentDir: string;
    let prefix: string;

    if (input.endsWith("/")) {
      parentDir = resolved;
      prefix = "";
    } else {
      parentDir = dirname(resolved);
      prefix = basename(resolved);
    }

    if (!existsSync(parentDir)) return [];

    const entries = readdirSync(parentDir, { withFileTypes: true });
    const showDots = prefix.startsWith(".");

    return entries
      .filter((e) => {
        if (!e.isDirectory()) return false;
        if (!showDots && e.name.startsWith(".")) return false;
        if (prefix && !e.name.toLowerCase().startsWith(prefix.toLowerCase())) return false;
        return true;
      })
      .map((e) => e.name)
      .sort()
      .slice(0, 12);
  } catch {
    return [];
  }
}

function getParentPath(input: string): string {
  const expanded = expandHome(input);
  const resolved = resolve(expanded);

  if (input.endsWith("/")) {
    return resolved;
  }
  return dirname(resolved);
}

export function FolderBrowser({ title = "Browse Folder", defaultValue = "~/", onSubmit, onCancel }: Props): React.ReactElement {
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [browseIndex, setBrowseIndex] = useState(-1); // -1 = typing mode

  useEffect(() => {
    setSuggestions(getDirectorySuggestions(value));
    setBrowseIndex(-1);
  }, [value]);

  useInput((input, key) => {
    if (key.escape) {
      if (browseIndex >= 0) {
        setBrowseIndex(-1);
      } else {
        onCancel();
      }
      return;
    }

    if (key.tab && suggestions.length > 0) {
      const pick = browseIndex >= 0 ? suggestions[browseIndex]! : suggestions[0]!;
      const parent = getParentPath(value);
      setValue(join(parent, pick) + "/");
      setBrowseIndex(-1);
      return;
    }

    if (browseIndex >= 0) {
      if (key.upArrow) {
        setBrowseIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setBrowseIndex((i) => Math.min(suggestions.length - 1, i + 1));
      } else if (key.return) {
        const pick = suggestions[browseIndex]!;
        const parent = getParentPath(value);
        setValue(join(parent, pick) + "/");
        setBrowseIndex(-1);
      }
      return;
    }

    if (key.downArrow && suggestions.length > 0) {
      setBrowseIndex(0);
      return;
    }

    if (key.return) {
      const expanded = resolve(expandHome(value));
      if (existsSync(expanded) && statSync(expanded).isDirectory()) {
        onSubmit(expanded);
      }
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
      <Text bold>{title}</Text>
      <Box>
        <Text>Path: </Text>
        {browseIndex < 0 ? (
          <TextInput value={value} onChange={setValue} />
        ) : (
          <Text>{value}</Text>
        )}
      </Box>
      {suggestions.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {suggestions.map((s, i) => (
            <Text key={s} color={i === browseIndex ? "cyan" : undefined} bold={i === browseIndex}>
              {i === browseIndex ? "> " : "  "}{s}/
            </Text>
          ))}
        </Box>
      )}
      <Text> </Text>
      <Text dimColor>
        {browseIndex >= 0
          ? "Up/Down: Navigate | Enter/Tab: Complete | Esc: Back"
          : "Tab: Complete | Down: Browse | Enter: Submit | Esc: Cancel"}
      </Text>
    </Box>
  );
}
