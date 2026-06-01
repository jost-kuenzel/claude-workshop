#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";

export interface GateInput {
  attempts: number;
  stopHookActive: boolean;
  lintPassed: boolean;
  testPassed: boolean;
  stderrTail?: string;
}

export interface GateDecision {
  action: "allow" | "block";
  nextAttempts: number;
  clearCounter: boolean;
  stderr?: string;
}

const MAX_ATTEMPTS = 3;

/** Pure decision: see spec "Stop hook semantics". */
export function decideGate(input: GateInput): GateDecision {
  if (input.stopHookActive) {
    return { action: "allow", nextAttempts: input.attempts, clearCounter: false };
  }
  const nextAttempts = input.attempts + 1;
  if (input.lintPassed && input.testPassed) {
    return { action: "allow", nextAttempts, clearCounter: true };
  }
  if (nextAttempts >= MAX_ATTEMPTS) {
    return { action: "allow", nextAttempts, clearCounter: true };
  }
  return {
    action: "block",
    nextAttempts,
    clearCounter: false,
    stderr: input.stderrTail ?? "lint or tests failed",
  };
}

async function run(cmd: string[]): Promise<{ ok: boolean; output: string }> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { ok: code === 0, output: out + err };
}

// I/O shell — executed only when this file is run directly, not when imported by tests.
if (import.meta.main) {
  const event = JSON.parse(await Bun.stdin.text());
  const sessionId: string = event.session_id ?? "unknown";
  const counterFile = `.factory/test-gate-attempts-${sessionId}.txt`;
  const attempts = existsSync(counterFile) ? Number(readFileSync(counterFile, "utf8")) || 0 : 0;

  const lint = await run(["bun", "run", "lint"]);
  const tests = await run(["bun", "test"]);
  const stderrTail = (lint.output + "\n" + tests.output).slice(-4096);

  const decision = decideGate({
    attempts,
    stopHookActive: event.stop_hook_active === true,
    lintPassed: lint.ok,
    testPassed: tests.ok,
    stderrTail,
  });

  if (decision.clearCounter) {
    if (existsSync(counterFile)) rmSync(counterFile);
  } else {
    writeFileSync(counterFile, String(decision.nextAttempts));
  }

  if (decision.action === "block") {
    process.stderr.write(decision.stderr ?? "");
    process.exit(2); // Claude Code convention: block stop, feed stderr to the model
  }
  process.exit(0);
}
