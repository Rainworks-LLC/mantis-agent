#!/bin/bash
set -euo pipefail

# Mantis Agent Installer for macOS and Linux
# Usage: curl -fsSL https://raw.githubusercontent.com/Rainworks-LLC/mantis-agent/main/install.sh | bash

# ─── Colors ───────────────────────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[38;2;0;229;150m'
CYAN='\033[38;2;0;200;200m'
YELLOW='\033[38;2;255;176;32m'
RED='\033[38;2;230;57;70m'
MUTED='\033[38;2;90;100;128m'
DIM='\033[2m'
NC='\033[0m'

# ─── UI helpers ───────────────────────────────────────────────────────────────
ui_info()    { echo -e "${MUTED}·${NC} $*"; }
ui_success() { echo -e "${GREEN}✓${NC} $*"; }
ui_warn()    { echo -e "${YELLOW}!${NC} $*"; }
ui_error()   { echo -e "${RED}✗${NC} $*"; }
ui_step()    { echo -e "\n${CYAN}${BOLD}$*${NC}"; }

STAGE=0
STAGE_TOTAL=3
ui_stage() {
    STAGE=$((STAGE + 1))
    echo -e "\n${GREEN}${BOLD}[${STAGE}/${STAGE_TOTAL}] $*${NC}"
}

# ─── Banner ───────────────────────────────────────────────────────────────────
print_banner() {
    echo ""
    echo -e "${GREEN}${BOLD}  🪲 Mantis Agent Installer${NC}"
    echo -e "${MUTED}  Autonomous, self-constructing agents powered by Ollama${NC}"
    echo ""
}

# ─── Defaults ─────────────────────────────────────────────────────────────────
DRY_RUN=${MANTIS_DRY_RUN:-0}
VERBOSE=${MANTIS_VERBOSE:-0}
MANTIS_VERSION=${MANTIS_VERSION:-latest}
SKIP_OLLAMA=${MANTIS_SKIP_OLLAMA:-0}

# ─── Argument parsing ────────────────────────────────────────────────────────
print_usage() {
    cat <<EOF
Mantis Agent installer (macOS + Linux)

Usage:
  curl -fsSL https://raw.githubusercontent.com/Rainworks-LLC/mantis-agent/main/install.sh | bash
  bash install.sh [options]

Options:
  --dry-run         Show what would happen without making changes
  --verbose         Show full command output
  --version <ver>   Install a specific version (default: latest)
  --skip-ollama     Skip Ollama check/install prompt
  -h, --help        Show this help

Environment variables:
  MANTIS_DRY_RUN=1      Same as --dry-run
  MANTIS_VERBOSE=1      Same as --verbose
  MANTIS_VERSION=x.y.z  Same as --version
  MANTIS_SKIP_OLLAMA=1  Same as --skip-ollama
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run)     DRY_RUN=1; shift ;;
            --verbose)     VERBOSE=1; shift ;;
            --skip-ollama) SKIP_OLLAMA=1; shift ;;
            --version)
                if [[ -z "${2:-}" ]]; then
                    ui_error "--version requires a value"
                    exit 1
                fi
                MANTIS_VERSION="$2"; shift 2 ;;
            -h|--help) print_usage; exit 0 ;;
            *)
                ui_error "Unknown option: $1"
                print_usage
                exit 1 ;;
        esac
    done
}

# ─── OS detection ─────────────────────────────────────────────────────────────
OS="unknown"
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]] || [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
        OS="linux"
    fi

    if [[ "$OS" == "unknown" ]]; then
        ui_error "Unsupported operating system: $OSTYPE"
        echo "This installer supports macOS and Linux (including WSL)."
        exit 1
    fi

    ui_success "Detected OS: ${OS}"
}

# ─── Node.js ──────────────────────────────────────────────────────────────────
NODE_MIN_MAJOR=20

node_major_version() {
    local ver
    ver="$(node --version 2>/dev/null || true)"
    if [[ -z "$ver" ]]; then
        echo "0"
        return
    fi
    echo "${ver}" | sed 's/^v//' | cut -d. -f1
}

check_node() {
    if ! command -v node &>/dev/null; then
        return 1
    fi
    local major
    major="$(node_major_version)"
    if (( major < NODE_MIN_MAJOR )); then
        return 1
    fi
    ui_success "Node.js $(node --version) found"
    return 0
}

install_node() {
    ui_warn "Node.js ${NODE_MIN_MAJOR}+ is required but not found"

    if [[ "$OS" == "macos" ]]; then
        if command -v brew &>/dev/null; then
            ui_info "Installing Node.js via Homebrew"
            if [[ "$DRY_RUN" == "1" ]]; then
                ui_info "[dry-run] brew install node"
                return 0
            fi
            brew install node
            ui_success "Node.js installed via Homebrew"
            return 0
        fi
    elif [[ "$OS" == "linux" ]]; then
        if command -v apt-get &>/dev/null; then
            ui_info "Installing Node.js via apt"
            if [[ "$DRY_RUN" == "1" ]]; then
                ui_info "[dry-run] curl NodeSource setup | sudo bash && sudo apt-get install nodejs"
                return 0
            fi
            curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ui_success "Node.js installed via apt"
            return 0
        fi
    fi

    ui_error "Could not auto-install Node.js"
    echo "Install Node.js ${NODE_MIN_MAJOR}+ manually: https://nodejs.org"
    exit 1
}

# ─── Ollama ───────────────────────────────────────────────────────────────────
check_ollama() {
    if command -v ollama &>/dev/null; then
        ui_success "Ollama found: $(ollama --version 2>/dev/null || echo 'installed')"
        return 0
    fi
    return 1
}

check_ollama_running() {
    if curl -sf http://localhost:11434/api/tags &>/dev/null; then
        ui_success "Ollama is running"
        return 0
    fi
    return 1
}

prompt_ollama_install() {
    if [[ "$SKIP_OLLAMA" == "1" ]]; then
        ui_info "Skipping Ollama check (--skip-ollama)"
        return 0
    fi

    ui_warn "Ollama is not installed"
    echo ""
    echo "  Mantis Agent requires Ollama to run local LLMs."
    echo "  Install it from: https://ollama.com"
    echo ""

    if [[ ! -t 0 || ! -t 1 ]]; then
        ui_info "No TTY; install Ollama manually and rerun"
        return 0
    fi

    read -rp "  Install Ollama now? [Y/n] " answer
    case "${answer:-y}" in
        [Yy]*)
            if [[ "$DRY_RUN" == "1" ]]; then
                ui_info "[dry-run] curl -fsSL https://ollama.com/install.sh | sh"
                return 0
            fi
            curl -fsSL https://ollama.com/install.sh | sh
            ui_success "Ollama installed"
            ;;
        *)
            ui_info "Skipping Ollama install — you can install it later from https://ollama.com"
            ;;
    esac
}

suggest_pull_model() {
    # Check if any models are available
    local models
    models="$(curl -sf http://localhost:11434/api/tags 2>/dev/null || true)"

    if [[ -n "$models" ]] && echo "$models" | grep -q '"name"'; then
        ui_success "Ollama has models available"
        return 0
    fi

    echo ""
    ui_info "No Ollama models found. Pull one to get started:"
    echo -e "  ${DIM}ollama pull llama3.1${NC}"
    echo ""
}

# ─── npm global install ──────────────────────────────────────────────────────
npm_prefix_is_writable() {
    local npm_prefix
    npm_prefix="$(npm config get prefix 2>/dev/null || echo "/usr/local")"

    # If prefix is under home dir, assume writable
    if [[ "$npm_prefix" == "$HOME"* ]]; then
        return 0
    fi

    # Test actual write access (more reliable than -w flag)
    local test_dir="${npm_prefix}/lib/node_modules"
    if [[ -d "$test_dir" ]]; then
        local test_file="${test_dir}/.mantis-write-test-$$"
        if touch "$test_file" 2>/dev/null; then
            rm -f "$test_file" 2>/dev/null
            return 0
        fi
    fi

    return 1
}

fix_npm_prefix() {
    # Reconfigure npm to use a user-writable prefix under $HOME
    local new_prefix="$HOME/.npm-global"
    ui_info "Configuring npm to use ${new_prefix} (avoids sudo)"
    mkdir -p "${new_prefix}"
    npm config set prefix "${new_prefix}"

    # Persist PATH addition into shell profiles
    # shellcheck disable=SC2016
    local path_line='export PATH="$HOME/.npm-global/bin:$PATH"'
    for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
        if [[ -f "$rc" ]] && ! grep -qF ".npm-global" "$rc"; then
            echo "$path_line" >> "$rc"
        fi
    done

    export PATH="${new_prefix}/bin:$PATH"
    ui_success "npm prefix set to ${new_prefix}"
}

has_tty() {
    [[ -t 0 && -t 1 ]]
}

install_mantis() {
    local spec="@rainworks-llc/mantis-agent"
    if [[ "$MANTIS_VERSION" != "latest" ]]; then
        spec="@rainworks-llc/mantis-agent@${MANTIS_VERSION}"
    fi

    if [[ "$DRY_RUN" == "1" ]]; then
        ui_info "[dry-run] npm install -g ${spec}"
        return 0
    fi

    # If the global npm directory isn't writable, fix it before we start
    if ! npm_prefix_is_writable; then
        if has_tty; then
            # Interactive: offer sudo or prefix fix
            ui_warn "Global npm directory is not writable"
            echo ""
            echo "  1) Fix npm prefix to install under your home directory (recommended)"
            echo "  2) Use sudo for this install"
            echo ""
            local answer
            read -rp "  Choose [1/2]: " answer
            case "${answer:-1}" in
                2)
                    ui_info "Will install with sudo"
                    ;;
                *)
                    fix_npm_prefix
                    ;;
            esac
        else
            # Non-interactive (curl | bash): auto-fix prefix
            fix_npm_prefix
        fi
    fi

    ui_info "Installing ${spec} globally via npm"

    local log
    log="$(mktemp)"
    trap "rm -f '$log'" RETURN

    local -a cmd=(npm install -g --no-fund --no-audit "$spec")

    # After potential prefix fix, check again if we still need sudo
    if ! npm_prefix_is_writable; then
        ui_info "Using sudo for npm install"
        cmd=(sudo npm install -g --no-fund --no-audit "$spec")
    fi

    if [[ "$VERBOSE" == "1" ]]; then
        if "${cmd[@]}" 2>&1 | tee "$log"; then
            ui_success "Mantis Agent installed"
            return 0
        fi
    else
        if "${cmd[@]}" >"$log" 2>&1; then
            ui_success "Mantis Agent installed"
            return 0
        fi
    fi

    # First attempt failed with EACCES — retry with sudo if we haven't already
    if grep -q "EACCES" "$log" 2>/dev/null; then
        if has_tty; then
            ui_warn "Permission denied — retrying with sudo"
            if sudo npm install -g --no-fund --no-audit "$spec" >"$log" 2>&1; then
                ui_success "Mantis Agent installed"
                return 0
            fi
        else
            ui_error "npm install failed — permission denied"
            echo ""
            ui_info "The installer is running non-interactively and cannot prompt for sudo."
            ui_info "Run the installer directly in a terminal instead:"
            echo -e "  ${DIM}curl -fsSL https://raw.githubusercontent.com/Rainworks-LLC/mantis-agent/main/install.sh | bash -s${NC}"
            echo ""
            ui_info "Or install manually with sudo:"
            echo -e "  ${DIM}sudo npm install -g ${spec}${NC}"
            echo ""
            tail -n 20 "$log" >&2
            return 1
        fi
    fi

    # Install failed — show diagnostics
    ui_error "npm install failed"
    echo ""
    tail -n 30 "$log" >&2
    echo ""
    ui_info "If this is a permissions issue, try:"
    echo -e "  ${DIM}sudo npm install -g ${spec}${NC}"
    echo -e "  ${DIM}# or fix npm permissions: https://docs.npmjs.com/resolving-eacces-permissions-errors${NC}"
    return 1
}

# ─── PATH check ──────────────────────────────────────────────────────────────
check_mantis_on_path() {
    if command -v mantis &>/dev/null; then
        ui_success "mantis CLI is on PATH"
        return 0
    fi

    local npm_bin
    npm_bin="$(npm config get prefix 2>/dev/null || echo "")/bin"

    ui_warn "mantis is not on your PATH"
    if [[ -n "$npm_bin" && -x "${npm_bin}/mantis" ]]; then
        ui_info "Found at: ${npm_bin}/mantis"
        ui_info "Add to your shell profile:"
        echo -e "  ${DIM}export PATH=\"${npm_bin}:\$PATH\"${NC}"
    fi
    return 1
}

# ─── Doctor ───────────────────────────────────────────────────────────────────
run_doctor() {
    local mantis_bin
    mantis_bin="$(command -v mantis 2>/dev/null || true)"
    if [[ -z "$mantis_bin" ]]; then
        return 0
    fi

    ui_info "Running mantis doctor"
    "$mantis_bin" doctor || true
}

# ─── Completion messages ─────────────────────────────────────────────────────
COMPLETIONS=(
    "The mantis is ready. Tell it what to build."
    "Workspace created. Your agent awaits instructions."
    "Installed. Time to create your first agent."
    "All set. Run mantis create to get started."
    "The mantis has landed. Let's build something."
    "Tools? Memory? Personality? Your agent handles all of it."
    "One CLI, infinite agents. Go wild."
    "Agents that build their own tools. What could go wrong?"
)

pick_completion() {
    echo "${COMPLETIONS[RANDOM % ${#COMPLETIONS[@]}]}"
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
    print_banner
    detect_os

    # Show plan
    ui_step "Install plan"
    echo -e "  ${MUTED}Version:${NC}  ${MANTIS_VERSION}"
    echo -e "  ${MUTED}Method:${NC}   npm (global)"
    echo -e "  ${MUTED}OS:${NC}       ${OS}"
    if [[ "$DRY_RUN" == "1" ]]; then
        echo -e "  ${MUTED}Dry run:${NC}  yes"
    fi

    # ── Stage 1: Environment ──
    ui_stage "Preparing environment"

    if ! check_node; then
        install_node
        if ! check_node; then
            ui_error "Node.js ${NODE_MIN_MAJOR}+ is required"
            echo "Install manually: https://nodejs.org"
            exit 1
        fi
    fi

    if ! check_ollama; then
        prompt_ollama_install
    else
        if ! check_ollama_running; then
            ui_warn "Ollama is installed but not running"
            ui_info "Start it with: ollama serve"
        fi
    fi

    # ── Stage 2: Install ──
    ui_stage "Installing Mantis Agent"

    install_mantis

    # ── Stage 3: Finalize ──
    ui_stage "Finalizing"

    check_mantis_on_path || true
    run_doctor

    if check_ollama_running 2>/dev/null; then
        suggest_pull_model
    fi

    # ── Done ──
    local version
    version="$(mantis --version 2>/dev/null || echo "")"

    echo ""
    if [[ -n "$version" ]]; then
        echo -e "${GREEN}${BOLD}  🪲 Mantis Agent installed successfully (v${version})!${NC}"
    else
        echo -e "${GREEN}${BOLD}  🪲 Mantis Agent installed successfully!${NC}"
    fi
    echo -e "${MUTED}  $(pick_completion)${NC}"
    echo ""

    ui_step "Next steps"
    echo -e "  ${DIM}mantis create${NC}          Create your first agent"
    echo -e "  ${DIM}mantis chat <agent>${NC}    Start chatting"
    echo -e "  ${DIM}mantis serve --open${NC}    Open the web UI"
    echo ""
    echo -e "  ${MUTED}Docs: https://github.com/Rainworks-LLC/mantis-agent${NC}"
    echo ""
}

parse_args "$@"
main
