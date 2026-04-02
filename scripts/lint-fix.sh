#!/usr/bin/env bash
# Auto-lint and format a file after Claude edits it.
# Called by the PostToolUse hook in .claude/settings.json.

file_path=$(cat | jq -r '.tool_input.file_path')

case "$file_path" in
  *.ts|*.tsx|*.js|*.mjs|*.json|*.md)
    npx eslint --fix "$file_path" 2>/dev/null
    npx prettier --write "$file_path" 2>/dev/null
    ;;
esac

exit 0
