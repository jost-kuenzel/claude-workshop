import { test, expect, describe } from 'bun:test';
import { decideGate } from '../factory-test-gate';

describe('decideGate', () => {
  test('allows immediately when stop_hook_active (prevents loops)', () => {
    const d = decideGate({
      attempts: 0,
      isAutomation: true,
      stopHookActive: true,
      lintPassed: false,
      testPassed: false,
    });
    expect(d.action).toBe('allow');
  });

  test('allows and clears the counter when lint and test both pass', () => {
    const d = decideGate({
      attempts: 0,
      isAutomation: true,
      stopHookActive: false,
      lintPassed: true,
      testPassed: true,
    });
    expect(d).toMatchObject({ action: 'allow', clearCounter: true });
  });

  test('blocks with stderr and increments when failing under the cap', () => {
    const d = decideGate({
      attempts: 0,
      isAutomation: true,
      stopHookActive: false,
      lintPassed: false,
      testPassed: true,
      stderrTail: 'lint error here',
    });
    expect(d.action).toBe('block');
    expect(d.nextAttempts).toBe(1);
    expect(d.clearCounter).toBe(false);
    expect(d.stderr).toContain('lint error here');
  });

  test('gives up (allow + clear) once attempts reach the cap of 3', () => {
    const d = decideGate({
      attempts: 2,
      isAutomation: true,
      stopHookActive: false,
      lintPassed: false,
      testPassed: false,
    });
    expect(d).toMatchObject({ action: 'allow', clearCounter: true });
  });

  test('isAutomation false → allow immediately regardless of lint/test results', () => {
    const d = decideGate({
      attempts: 0,
      isAutomation: false,
      stopHookActive: false,
      lintPassed: false,
      testPassed: false,
    });
    expect(d).toMatchObject({ action: 'allow', clearCounter: false });
    expect(d.nextAttempts).toBe(0);
  });
});
