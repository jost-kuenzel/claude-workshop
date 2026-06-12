# Claude dev container — SP1 (issue #52).
#
# Adapted from Anthropic's reference Claude Code dev container:
#   https://github.com/anthropics/claude-code/tree/main/.devcontainer
#
# Base is node:24 (Active LTS, supported to Apr 2028 — node:20 is EOL). It is
# multi-arch (arm64 on the Mac, amd64 in CI), ships node+npm for the pinned
# Claude CLI install, and a uid/gid 1000 user we rename to the non-root `dev`
# user that the firewall sudoers rule and `remoteUser` both depend on.
# Anthropic's reference uses node:20 + the `node` user; we track current LTS and
# rename the user to `dev`.
FROM node:24

ARG TZ
ENV TZ="$TZ"

# Pinned for reproducibility — bump these deliberately, never float them.
# CLAUDE_CODE_VERSION must be >= 2.1.83 for `--permission-mode auto`.
ARG CLAUDE_CODE_VERSION=2.1.175
ARG BUN_VERSION=1.2.0
ARG PLAYWRIGHT_VERSION=1.60.0
ARG GIT_DELTA_VERSION=0.18.2
ARG ZSH_IN_DOCKER_VERSION=1.2.0

# Non-root user name. Renamed from the base image's `node` user below.
ARG USERNAME=dev

# Basic dev tools + firewall deps (iptables/ipset/dnsutils/aggregate/jq are used
# by init-firewall.sh) + curl/ca-certificates/wget for egress checks & installs.
RUN apt-get update && apt-get install -y --no-install-recommends \
  less git procps sudo fzf zsh man-db unzip gnupg2 gh \
  iptables ipset iproute2 dnsutils aggregate jq \
  nano vim curl ca-certificates wget \
  ncurses-term \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Rename the base image's node user/group (uid/gid 1000) to ${USERNAME} and move
# its home to /home/${USERNAME}. The Node.js runtime binary (/usr/local/bin/node)
# is unrelated to the user name and is unaffected.
RUN groupmod -n ${USERNAME} node \
  && usermod -l ${USERNAME} -d /home/${USERNAME} -m node

# Ensure the dev user can write global npm packages.
RUN mkdir -p /usr/local/share/npm-global && chown -R ${USERNAME}:${USERNAME} /usr/local/share

# Persist shell history (mounted to a named volume at runtime).
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  && mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R $USERNAME /commandhistory

# Help Claude orient itself.
ENV DEVCONTAINER=true

# Fixed, writable browser-cache path so the baked Chromium + Claude's
# `playwright-cli` daemon dir resolve correctly at runtime (no CDN egress).
ENV PLAYWRIGHT_BROWSERS_PATH=/home/${USERNAME}/.cache/ms-playwright

# Workspace + Claude config + playwright cache, owned by the dev user.
RUN mkdir -p /workspace /home/${USERNAME}/.claude "$PLAYWRIGHT_BROWSERS_PATH" \
  && chown -R ${USERNAME}:${USERNAME} /workspace /home/${USERNAME}/.claude /home/${USERNAME}/.cache

WORKDIR /workspace

# git-delta for nicer diffs (matches the Anthropic reference).
RUN ARCH=$(dpkg --print-architecture) \
  && wget "https://github.com/dandavison/delta/releases/download/${GIT_DELTA_VERSION}/git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" \
  && dpkg -i "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" \
  && rm "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb"

# Bake Chromium's OS dependencies at build time (root). The browser binary
# itself is installed below as the dev user into PLAYWRIGHT_BROWSERS_PATH, so
# no browser CDN egress is needed at runtime. We use the official Playwright
# installer here as the build-time equivalent of `playwright-cli install-browser`.
RUN npx -y playwright@${PLAYWRIGHT_VERSION} install-deps chromium

# ---- Everything below runs as the non-root dev user ----
USER ${USERNAME}

ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin
ENV SHELL=/bin/zsh
ENV EDITOR=nano
ENV VISUAL=nano
# The image is deterministic; never let the CLI self-update in place.
ENV DISABLE_AUTOUPDATER=1

# Pinned toolchain: bun (matches package.json packageManager) + Claude CLI.
RUN npm install -g bun@${BUN_VERSION} @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

# Baked Chromium into the dev user's PLAYWRIGHT_BROWSERS_PATH.
RUN npx -y playwright@${PLAYWRIGHT_VERSION} install chromium

# oh-my-zsh with the simple robbyrussell theme (no special/Nerd font needed).
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v${ZSH_IN_DOCKER_VERSION}/zsh-in-docker.sh)" -- \
  -t robbyrussell \
  -p git -p fzf \
  -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
  -a "source /usr/share/doc/fzf/examples/completion.zsh" \
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  -x

# Firewall script + passwordless sudo for it (the only NET_ADMIN action).
COPY init-firewall.sh /usr/local/bin/
USER root
RUN chmod +x /usr/local/bin/init-firewall.sh \
  && echo "${USERNAME} ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/${USERNAME}-firewall \
  && chmod 0440 /etc/sudoers.d/${USERNAME}-firewall
USER ${USERNAME}
