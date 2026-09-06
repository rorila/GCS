# 🤖 AI STRATEGIC INSTRUCTIONS (MANDATORY)

**Status: ACTIVE**
**Scope: ALL MODELS & SESSIONS**

## 🛑 STOP! READ THIS BEFORE STARTING ANY TASK

To prevent regressions and maintain architecture quality in this project, you MUST follow these steps without exception:

### 1. ANALYSIS PHASE
- Always check `docs/use_cases/UseCaseIndex.txt` first.
- Read `DEVELOPER_GUIDELINES.md` for current implementation patterns.
- Perform an **Impact Analysis**: "What breaks if I change this?"

### 2. EXECUTION PHASE
- Write clean, reactive code.
- Reflect changes in JSON and Pascal code if applicable.
- **NEVER** skip the verification step.

### 3. MANDATORY VERIFICATION (DEFINITION OF DONE)
- Run `npm run test` after **every** meaningful change.
- Verify that `docs/QA_Report.md` is updated and all tests are **GREEN**.
- If a test fails, you **MUST** fix it before notifying the user.

### 4. DOCUMENTATION
- Update `CHANGELOG.md`.
- Update `DEVELOPER_GUIDELINES.md` if new patterns emerge.

**FAILURE TO EXECUTE TESTS IS A CRITICAL VIOLATION OF PROJECT RULES.**
