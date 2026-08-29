#!/bin/bash
# Materialize the plugins this repo declares in .claude/settings.json.
#
# enabledPlugins/extraKnownMarketplaces travel with the repo, but the
# marketplace clones and plugin payloads live outside git (~/.claude/plugins).
# A fresh checkout — or any Claude Code on the web container, which starts
# empty every time — has the declaration but not the payloads, so the skills
# silently never load. This restores whatever is declared but missing, in two
# steps (marketplaces first: installing a plugin from an uncached marketplace
# fails with "not found in marketplace"), and no-ops otherwise.
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SETTINGS="$PROJECT_DIR/.claude/settings.json"
PLUGIN_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins"

# Nothing to do without the CLI, node, or a settings file.
command -v claude >/dev/null 2>&1 || exit 0
command -v node   >/dev/null 2>&1 || exit 0
[ -f "$SETTINGS" ] || exit 0

# What is declared, minus what is already on disk. Emits "M<TAB>source" for
# each missing marketplace and "P<TAB>id" for each missing plugin.
missing=$(node -e '
const fs = require("fs");
const [settingsPath, pluginDir] = process.argv.slice(1);
const read = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return {}; } };

const settings = read(settingsPath);
const marketplaces = read(pluginDir + "/known_marketplaces.json");
const installed = read(pluginDir + "/installed_plugins.json").plugins || {};
const out = [];

for (const [name, entry] of Object.entries(settings.extraKnownMarketplaces || {})) {
  const known = marketplaces[name];
  if (known && known.installLocation && fs.existsSync(known.installLocation)) continue;
  // `claude plugin marketplace add` takes a GitHub owner/repo, a URL, or a path.
  const src = entry.source || {};
  const ref = src.repo || src.url || src.path || src.source;
  if (ref) out.push("M\t" + ref);
}

for (const [id, enabled] of Object.entries(settings.enabledPlugins || {})) {
  if (enabled === false) continue;
  const entries = installed[id];
  const present = Array.isArray(entries)
    && entries.some((e) => e.installPath && fs.existsSync(e.installPath));
  if (!present) out.push("P\t" + id);
}

process.stdout.write(out.join("\n"));
' "$SETTINGS" "$PLUGIN_DIR")

[ -n "$missing" ] || exit 0

cd "$PROJECT_DIR"
markets=0
plugins=0
failed=""

while IFS=$'\t' read -r kind ref; do
  [ -n "${ref:-}" ] || continue
  case "$kind" in
    M)
      if claude plugin marketplace add "$ref" --scope project >/dev/null 2>&1 \
        || claude plugin marketplace update "$ref" >/dev/null 2>&1; then
        markets=$((markets + 1))
      else
        failed="$failed $ref"
      fi
      ;;
    P)
      if claude plugin install "$ref" --scope project -y >/dev/null 2>&1; then
        plugins=$((plugins + 1))
      else
        failed="$failed $ref"
      fi
      ;;
  esac
done <<< "$missing"

echo "Restored $markets marketplace(s) and $plugins plugin(s) declared in .claude/settings.json."
[ -z "$failed" ] || echo "Failed:$failed — install manually with 'claude plugin install <id> --scope project -y'."
