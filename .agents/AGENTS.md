# Project-Scoped Agent Rules

## Verification & Testing Policy
- **Do NOT run end-to-end verification or UI testing**: Do not test features yourself by simulating logins, running through flows, or verifying behavior end-to-end using tool calls/agent actions (e.g., `browser_subagent`). This consumes excessive tokens and isn't necessary.
- **Static & Logical Review**: Implement requested changes fully and carefully. Perform a quick static/logical review of your own code (read it back, check for obvious bugs, confirm the logic matches requirements) before completing the task.
- **User Testing**: The user will test all features and UI changes themselves after you finish implementing them.
- **Concise Summaries**: When finishing a task, provide a short summary of what you built and any design/technical decisions made. Do NOT state intentions to test or run verification steps.
