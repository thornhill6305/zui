const colors = {
  header: { bg: "cyan", fg: "black" },
  footer: { bg: "cyan", fg: "black" },
  selected: { bg: "white", fg: "black" },
  statusWork: "cyan",
  statusWait: "yellow",
  statusErr: "red",
  statusIdle: "green",
  dim: "gray",
} as const;

export function statusColor(status: string): string {
  if (status.includes("WAIT")) return colors.statusWait;
  if (status.includes("ERR")) return colors.statusErr;
  if (status.includes("IDLE")) return colors.statusIdle;
  return colors.statusWork;
}
