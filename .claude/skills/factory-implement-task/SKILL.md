---
name: factory-implement-task
description: Use to implement exactly ONE plan task on the current branch by dispatching the factory-implementer, then the factory-spec-reviewer, then the factory-code-quality-reviewer, iterating until both reviewers approve.
---

# Factory Implement Task

Implement exactly ONE task from a plan already committed to the current branch.
Dispatch a fresh implementer subagent, then review in two stages: spec compliance
first, then code quality. **Do not loop over other tasks** — the surrounding
`task-run.ts` pipeline owns iteration across tasks.

## When to Use

```mermaid
flowchart TD
    A{"Exactly one task<br/>to implement?"} -- no --> X["Wrong skill — this skill<br/>does a single task only"]
    A -- yes --> B{"Plan already committed<br/>on current branch?"}
    B -- no --> Y["Stop — generate/commit the plan first"]
    B -- yes --> C["Use factory-implement-task"]
```

## The Process

```mermaid
flowchart TD
    S["task-run.ts invokes claude<br/>with this skill"] --> I["Dispatch <b>factory-implementer</b><br/>(TDD, commits its own work)"]
    I --> SR["Dispatch <b>factory-spec-reviewer</b><br/>(read-only): code vs spec/task"]
    SR --> SRq{Spec compliant?}
    SRq -- no --> IF["implementer fixes spec gaps"]
    IF --> SR
    SRq -- yes --> CQ["Dispatch <b>factory-code-quality-reviewer</b><br/>(read-only)"]
    CQ --> CQq{Approved?}
    CQq -- no --> IQ["implementer fixes quality issues"]
    IQ --> CQ
    CQq -- yes --> D["Edit plan: - [ ] → - [x]<br/>for this task; commit the check-off"]
```

## Rules

- Dispatch the implementer with the full task text (it does not read the plan file).
- Spec review happens BEFORE code-quality review. Never reorder.
- A reviewer that finds issues → implementer fixes → re-review. Repeat until approved.
- Both reviewers are read-only; only the implementer changes files.
- The agents enforce factory mode (single task, current branch, no worktree, no
  branch creation, no push, no PR) through their own tool allowlists — you do not
  need to restate those rules to them.
- When both reviews pass and tests are green, flip this task's `- [ ]` to `- [x]`
  in the plan's `## Task Checklist` and commit with
  `factory: complete task <N> — <task title>`.

## Red Flags

- Starting code-quality review before spec compliance is ✅
- Proceeding to the check-off with an open review issue
- Looping to another task (out of scope for this skill)
