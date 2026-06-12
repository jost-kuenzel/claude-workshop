import { expect, test } from "bun:test";
import {
  parseFlags,
  buildUpArgs,
  buildExecArgs,
  containerCommand,
  forwardedRemoteEnv,
} from "../sandbox";

test("parseFlags: defaults are all false", () => {
  expect(parseFlags([])).toEqual({ claude: false, rebuild: false });
});

test("parseFlags: recognizes --claude and --rebuild, ignores unknown flags", () => {
  expect(parseFlags(["--claude", "--rebuild", "--nope"])).toEqual({
    claude: true,
    rebuild: true,
  });
});

test("buildUpArgs: idempotent up by default", () => {
  expect(buildUpArgs({ workspace: ".", rebuild: false })).toEqual([
    "@devcontainers/cli",
    "up",
    "--workspace-folder",
    ".",
  ]);
});

test("buildUpArgs: --rebuild adds --remove-existing-container", () => {
  expect(buildUpArgs({ workspace: ".", rebuild: true })).toEqual([
    "@devcontainers/cli",
    "up",
    "--workspace-folder",
    ".",
    "--remove-existing-container",
  ]);
});

test("buildExecArgs: shell with no remote env", () => {
  expect(buildExecArgs({ workspace: ".", command: ["zsh"] })).toEqual([
    "@devcontainers/cli",
    "exec",
    "--workspace-folder",
    ".",
    "zsh",
  ]);
});

test("buildExecArgs: forwards remote env before the command", () => {
  expect(
    buildExecArgs({
      workspace: ".",
      command: ["claude", "--permission-mode", "auto"],
      remoteEnv: { CLAUDE_CODE_OAUTH_TOKEN: "tok-123" },
    })
  ).toEqual([
    "@devcontainers/cli",
    "exec",
    "--workspace-folder",
    ".",
    "--remote-env",
    "CLAUDE_CODE_OAUTH_TOKEN=tok-123",
    "claude",
    "--permission-mode",
    "auto",
  ]);
});

test("containerCommand: shell vs auto-mode claude", () => {
  expect(containerCommand({ claude: false, rebuild: false })).toEqual(["zsh"]);
  expect(containerCommand({ claude: true, rebuild: false })).toEqual([
    "claude",
    "--permission-mode",
    "auto",
  ]);
});

test("forwardedRemoteEnv: forwards the token only when set", () => {
  expect(forwardedRemoteEnv({ CLAUDE_CODE_OAUTH_TOKEN: "tok" })).toEqual({
    CLAUDE_CODE_OAUTH_TOKEN: "tok",
  });
  expect(forwardedRemoteEnv({})).toEqual({});
  expect(forwardedRemoteEnv({ CLAUDE_CODE_OAUTH_TOKEN: undefined })).toEqual({});
});

test("forwardedRemoteEnv: forwards TERM/COLORTERM for color capability", () => {
  expect(forwardedRemoteEnv({ TERM: "xterm-256color", COLORTERM: "truecolor" })).toEqual({
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
  });
});

test("forwardedRemoteEnv: forwards all set vars together, skips unset", () => {
  expect(
    forwardedRemoteEnv({
      CLAUDE_CODE_OAUTH_TOKEN: "tok",
      TERM: "xterm-256color",
      COLORTERM: undefined,
      IGNORED: "nope",
    })
  ).toEqual({ CLAUDE_CODE_OAUTH_TOKEN: "tok", TERM: "xterm-256color" });
});
