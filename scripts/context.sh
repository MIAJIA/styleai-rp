#!/bin/bash
#
# Context Generator
#
# Generates CLAUDE.md and AGENTS.md from context.json files
#
# Usage:
#   ./scripts/context.sh           - Generate root CLAUDE.md from docs/context.json
#   ./scripts/context.sh backend   - Generate backend/CLAUDE.md from backend/docs/context.json only
#   ./scripts/context.sh -a        - Update all folders with context.json + root from base context only
#
# Context files:
#   Base: docs/context.local.json OR docs/context.json
#         (.local.json overrides .json if exists, gitignored)
#   Scope: {scope}/docs/context.local.json OR {scope}/docs/context.json
#          (.local.json overrides .json if exists, gitignored)
#
# Context Structure:
#
#   Each scope follows a standard structure for AI agent context:
#
#   {scope}/
#   ├── README.md              # High-level overview of this scope
#   ├── CLAUDE.md              # Generated (gitignored) - AI agent context for this scope
#   └── docs/
#       ├── README.md          # Index of docs in this folder
#       └── context.json       # Config for generating {scope}/CLAUDE.md
#
#   File Purposes:
#     {scope}/README.md           - Brief overview of what the scope is about (edit)
#     {scope}/docs/README.md      - Index of documentation files (edit)
#     {scope}/docs/context.json   - Defines which files get injected into CLAUDE.md (edit)
#     {scope}/CLAUDE.md           - Generated context for AI agents (regenerate, don't edit)
#
#   context.json Format:
#     - "system": Core docs the agent must know
#     - "docs": Additional reference docs
#     - "code": Key source files for context
#     - "exclude": Files to skip
#     - Paths are relative to scope directory
#     - Use ../ for files outside the scope
#
#   Ordering (generic → specific, high-level → detailed):
#     1. Index files (README.md, docs/README.md) - what exists
#     2. Rules - how we work
#     3. Development/workflow docs - how to do things
#     4. Architecture docs - how this scope is built
#     5. Key implementation files - the actual code
#     6. Learnings - gotchas specific to this scope
#
#     Generic/High-level (first)
#     ├── Index files (docs/README.md) - "what exists"
#     ├── Rules - "how we work"
#     ├── Development/workflow docs - "how to do things"
#     │
#     Specific/Detailed (last)
#     ├── Architecture docs - "how this scope works"
#     ├── Key implementation files - "the actual code"
#     └── Learnings - "gotchas specific to this scope"
#
#   Example (ordered):
#     {
#       "system": [
#         "README.md",            # 1. What is this scope
#         "docs/README.md",       # 2. Index of docs
#         "docs/rules.md",        # 3. How we work
#         "docs/development.md",  # 4. Workflow
#         "docs/architecture.md", # 5. How it's built
#         "docs/learnings.md"     # 6. Specific gotchas
#       ]
#     }
#
#   Root Context (docs/context.json):
#     Defines shared, cross-cutting context included in every scope context.
#     Keep it small - only truly cross-cutting files.
#
#   Local Overrides:
#     Create context.local.json alongside context.json for local customization (gitignored).
#     - docs/context.local.json overrides docs/context.json
#     - {scope}/docs/context.local.json overrides {scope}/docs/context.json
#
#   Path resolution:
#     - Relative paths: resolved from project root (base) or scope dir (scope)
#     - ../ paths: resolved from project root
#     - Absolute paths: used as-is

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

get_base_context() {
    if [ -f "$PROJECT_ROOT/docs/context.local.json" ]; then
        echo "$PROJECT_ROOT/docs/context.local.json"
    elif [ -f "$PROJECT_ROOT/docs/context.json" ]; then
        echo "$PROJECT_ROOT/docs/context.json"
    else
        echo ""
    fi
}

get_base_msg() {
    if [ -f "$PROJECT_ROOT/docs/context.local.json" ]; then
        echo "docs/context.local.json (override)"
    else
        echo "docs/context.json"
    fi
}

BASE_CONTEXT=$(get_base_context)
if [ -z "$BASE_CONTEXT" ]; then
    echo "Error: No context file found."
    echo "Please create one of the following:"
    echo "  - docs/context.json (base context)"
    echo "  - docs/context.local.json (local override, gitignored)"
    exit 1
fi
BASE_MSG=$(get_base_msg)

declare -a EXCLUDE_PATTERNS=()
declare -a PROCESSED_FILES=()
declare -a PROCESSED_DISPLAY_NAMES=()
declare -a FILE_STATS_NAME=()
declare -a FILE_STATS_LINES=()
declare -a FILE_STATS_CHARS=()
declare -a FILE_STATS_TOKENS=()

collect_exclude_patterns() {
    local context_file="$1"
    local scope="$2"
    local excludes=$(jq -r '.exclude[]?' "$context_file" 2>/dev/null)

    for pattern in $excludes; do
        local resolved_pattern

        if [[ "$pattern" = /* ]]; then
            resolved_pattern="$pattern"
        elif [[ "$pattern" = ../* ]]; then
            local relative_path="${pattern#../}"
            resolved_pattern="$PROJECT_ROOT/$relative_path"
        elif [[ -n "$scope" ]]; then
            resolved_pattern="$PROJECT_ROOT/$scope/$pattern"
        else
            resolved_pattern="$PROJECT_ROOT/$pattern"
        fi

        EXCLUDE_PATTERNS+=("$resolved_pattern")
    done
}

should_exclude() {
    local filepath="$1"
    for pattern in "${EXCLUDE_PATTERNS[@]}"; do
        if [[ "$filepath" == "$pattern" ]]; then
            return 0
        fi
    done
    return 1
}

is_already_processed() {
    local filepath="$1"
    for i in "${!PROCESSED_FILES[@]}"; do
        if [[ "${PROCESSED_FILES[$i]}" == "$filepath" ]]; then
            echo "${PROCESSED_DISPLAY_NAMES[$i]}"
            return 0
        fi
    done
    return 1
}

process_context_file() {
    local context_file="$1"
    local scope="$2"
    local sections=$(jq -r 'keys[] | select(. != "exclude")' "$context_file" 2>/dev/null)

    for section in $sections; do
        local files=$(jq -r ".${section}[]?" "$context_file" 2>/dev/null)

        if [ -n "$files" ]; then
            local section_title=$(echo "$section" | awk '{print toupper(substr($0,1,1)) substr($0,2)}')
            echo "## $section_title" >> "$OUTPUT_FILE"
            echo "" >> "$OUTPUT_FILE"

            for file in $files; do
                local filepath
                local display_name

                if [[ "$file" = /* ]]; then
                    filepath="$file"
                    display_name="$(basename "$file")"
                elif [[ "$file" = ../* ]]; then
                    local relative_path="${file#../}"
                    filepath="$PROJECT_ROOT/$relative_path"
                    display_name="$relative_path"
                elif [[ -n "$scope" ]]; then
                    filepath="$PROJECT_ROOT/$scope/$file"
                    display_name="$scope/$file"
                else
                    filepath="$PROJECT_ROOT/$file"
                    display_name="$file"
                fi

                if [ -f "$filepath" ]; then
                    if should_exclude "$filepath"; then
                        echo "Excluding: $display_name" >&2
                    else
                        local previous_name
                        if previous_name=$(is_already_processed "$filepath"); then
                            echo "Skipping duplicate: $display_name (already included as $previous_name)" >&2
                        else
                            PROCESSED_FILES+=("$filepath")
                            PROCESSED_DISPLAY_NAMES+=("$display_name")

                            # Track file stats
                            local file_lines=$(wc -l < "$filepath" | tr -d ' ')
                            local file_chars=$(wc -c < "$filepath" | tr -d ' ')
                            local file_tokens=$((file_chars / 4))
                            FILE_STATS_NAME+=("$display_name")
                            FILE_STATS_LINES+=("$file_lines")
                            FILE_STATS_CHARS+=("$file_chars")
                            FILE_STATS_TOKENS+=("$file_tokens")

                            echo "<$display_name>" >> "$OUTPUT_FILE"
                            echo "" >> "$OUTPUT_FILE"
                            cat "$filepath" >> "$OUTPUT_FILE"
                            echo "" >> "$OUTPUT_FILE"
                            echo "</$display_name>" >> "$OUTPUT_FILE"
                            echo "" >> "$OUTPUT_FILE"
                        fi
                    fi
                else
                    echo "Warning: File not found: ${filepath#$PROJECT_ROOT/}" >&2
                fi
            done
        fi
    done
}

process_scope() {
    local SCOPE="$1"
    local QUIET="${2:-false}"
    local OUTPUT_DIR
    local SCOPE_CONTEXT
    local OUTPUT_FILE
    local AGENTS_FILE

    EXCLUDE_PATTERNS=()
    PROCESSED_FILES=()
    PROCESSED_DISPLAY_NAMES=()
    FILE_STATS_NAME=()
    FILE_STATS_LINES=()
    FILE_STATS_CHARS=()
    FILE_STATS_TOKENS=()

    local USE_BASE_CONTEXT="true"

    if [ -n "$SCOPE" ]; then
        OUTPUT_DIR="$PROJECT_ROOT/$SCOPE"
        local SCOPE_DOCS_DIR="$PROJECT_ROOT/$SCOPE/docs"
        mkdir -p "$SCOPE_DOCS_DIR"

        if [ -f "$SCOPE_DOCS_DIR/context.local.json" ]; then
            SCOPE_CONTEXT="$SCOPE_DOCS_DIR/context.local.json"
            USE_BASE_CONTEXT="false"
            [ "$QUIET" = "false" ] && echo "Using: $SCOPE/docs/context.local.json (override)"
        elif [ -f "$SCOPE_DOCS_DIR/context.json" ]; then
            SCOPE_CONTEXT="$SCOPE_DOCS_DIR/context.json"
            USE_BASE_CONTEXT="false"
            [ "$QUIET" = "false" ] && echo "Using: $SCOPE/docs/context.json"
        else
            SCOPE_CONTEXT=""
            [ "$QUIET" = "false" ] && echo "Using: $BASE_MSG (no scope context found)"
        fi
    else
        OUTPUT_DIR="$PROJECT_ROOT"
        SCOPE_CONTEXT=""
        [ "$QUIET" = "false" ] && echo "Using: $BASE_MSG"
    fi

    OUTPUT_FILE="$OUTPUT_DIR/CLAUDE.md"
    AGENTS_FILE="$OUTPUT_DIR/AGENTS.md"

    if [ "$USE_BASE_CONTEXT" = "true" ]; then
        collect_exclude_patterns "$BASE_CONTEXT" ""
    fi
    if [ -n "$SCOPE_CONTEXT" ]; then
        collect_exclude_patterns "$SCOPE_CONTEXT" "$SCOPE"
    fi

    echo "# Project Context" > "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"

    if [ "$USE_BASE_CONTEXT" = "true" ]; then
        process_context_file "$BASE_CONTEXT" ""
    fi
    if [ -n "$SCOPE_CONTEXT" ]; then
        process_context_file "$SCOPE_CONTEXT" "$SCOPE"
    fi

    cp "$OUTPUT_FILE" "$AGENTS_FILE"

    local lines=$(wc -l < "$OUTPUT_FILE" | tr -d ' ')
    local chars=$(wc -c < "$OUTPUT_FILE" | tr -d ' ')
    local tokens=$((chars / 4))

    if [ "$QUIET" = "true" ]; then
        echo "$lines|$chars|$tokens"
    else
        local OUTPUT_REL="${OUTPUT_FILE#$PROJECT_ROOT/}"
        local AGENTS_REL="${AGENTS_FILE#$PROJECT_ROOT/}"

        echo ""
        echo "Context generated:"
        echo "  - $OUTPUT_REL ($lines lines, $chars chars, ~$tokens tokens)"
        echo "  - $AGENTS_REL ($lines lines, $chars chars, ~$tokens tokens)"

        # Show per-file breakdown
        if [ ${#FILE_STATS_NAME[@]} -gt 0 ]; then
            echo ""
            echo "┌────────────────────────────────────────────┬─────────┬──────────┬──────────┬───────┐"
            echo "│ File                                       │  Lines  │   Chars  │  Tokens  │   %   │"
            echo "├────────────────────────────────────────────┼─────────┼──────────┼──────────┼───────┤"
            for i in "${!FILE_STATS_NAME[@]}"; do
                local name="${FILE_STATS_NAME[$i]}"
                # Truncate long names
                if [ ${#name} -gt 42 ]; then
                    name="...${name: -39}"
                fi
                local pct=0
                if [ "$tokens" -gt 0 ]; then
                    pct=$((FILE_STATS_TOKENS[$i] * 100 / tokens))
                fi
                printf "│ %-42s │ %7s │ %8s │ %8s │ %4s%% │\n" \
                    "$name" \
                    "${FILE_STATS_LINES[$i]}" \
                    "${FILE_STATS_CHARS[$i]}" \
                    "${FILE_STATS_TOKENS[$i]}" \
                    "$pct"
            done
            echo "├────────────────────────────────────────────┼─────────┼──────────┼──────────┼───────┤"
            printf "│ %-42s │ %7s │ %8s │ %8s │ %4s%% │\n" \
                "TOTAL" \
                "$lines" \
                "$chars" \
                "$tokens" \
                "100"
            echo "└────────────────────────────────────────────┴─────────┴──────────┴──────────┴───────┘"
        fi
    fi
}

if [ "$1" = "-a" ]; then
    SCOPES=()
    for context_file in "$PROJECT_ROOT"/*/docs/context.json "$PROJECT_ROOT"/*/docs/context.local.json; do
        if [ -f "$context_file" ]; then
            scope_dir=$(dirname "$(dirname "$context_file")")
            scope=$(basename "$scope_dir")
            if [[ ! " ${SCOPES[*]} " =~ " ${scope} " ]]; then
                SCOPES+=("$scope")
            fi
        fi
    done

    declare -a RESULTS_SCOPE=()
    declare -a RESULTS_LINES=()
    declare -a RESULTS_CHARS=()
    declare -a RESULTS_TOKENS=()
    declare -a ALL_WARNINGS=()

    # Process root first (base context only)
    output=$(process_scope "" "true" 2>&1)
    warnings=$(echo "$output" | grep -E "^Warning:" || true)
    stats=$(echo "$output" | grep -E "^[0-9]+\|" || true)

    if [ -n "$warnings" ]; then
        while IFS= read -r warning; do
            ALL_WARNINGS+=("$warning")
        done <<< "$warnings"
    fi

    if [ -n "$stats" ]; then
        IFS='|' read -r lines chars tokens <<< "$stats"
        RESULTS_SCOPE+=("root")
        RESULTS_LINES+=("$lines")
        RESULTS_CHARS+=("$chars")
        RESULTS_TOKENS+=("$tokens")
    fi

    # Process each scope
    for scope in "${SCOPES[@]}"; do
        output=$(process_scope "$scope" "true" 2>&1)
        warnings=$(echo "$output" | grep -E "^Warning:" || true)
        stats=$(echo "$output" | grep -E "^[0-9]+\|" || true)

        if [ -n "$warnings" ]; then
            while IFS= read -r warning; do
                ALL_WARNINGS+=("$warning")
            done <<< "$warnings"
        fi

        if [ -n "$stats" ]; then
            IFS='|' read -r lines chars tokens <<< "$stats"
            RESULTS_SCOPE+=("$scope")
            RESULTS_LINES+=("$lines")
            RESULTS_CHARS+=("$chars")
            RESULTS_TOKENS+=("$tokens")
        fi
    done

    echo "┌──────────────┬─────────┬──────────┬──────────┐"
    echo "│ Scope        │  Lines  │   Chars  │  Tokens  │"
    echo "├──────────────┼─────────┼──────────┼──────────┤"
    for i in "${!RESULTS_SCOPE[@]}"; do
        printf "│ %-12s │ %7s │ %8s │ %8s │\n" \
            "${RESULTS_SCOPE[$i]}" \
            "${RESULTS_LINES[$i]}" \
            "${RESULTS_CHARS[$i]}" \
            "${RESULTS_TOKENS[$i]}"
    done
    echo "└──────────────┴─────────┴──────────┴──────────┘"

    if [ ${#ALL_WARNINGS[@]} -gt 0 ]; then
        echo ""
        echo "Warnings:"
        printf '%s\n' "${ALL_WARNINGS[@]}" | sed 's/^Warning: //' | sort -u | while read -r w; do
            echo "  - $w"
        done
    fi
else
    process_scope "${1:-}"
fi
