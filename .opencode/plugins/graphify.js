// graphify OpenCode plugin
// Injects a knowledge graph reminder before shell tool calls when the graph exists.
import { existsSync } from "fs";
import { join } from "path";

export const GraphifyPlugin = async ({ directory }) => {
  let reminded = false;

  return {
    "tool.execute.before": async (input, output) => {
      if (reminded) return;
      if (!existsSync(join(directory, "graphify-out", "graph.json"))) return;
      if (input.tool !== "shell" && input.tool !== "bash") return;

      const args = output.args ?? {};
      const key =
        typeof args.command === "string"
          ? "command"
          : typeof args.cmd === "string"
            ? "cmd"
            : null;
      if (!key) return;

      // Use `;` so the prefix works in both PowerShell and POSIX shells.
      args[key] =
        'echo "[graphify] Knowledge graph available. Read graphify-out/GRAPH_REPORT.md for god nodes and architecture context before searching files." ; ' +
        args[key];
      reminded = true;
    },
  };
};
