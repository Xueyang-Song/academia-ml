# Copilot bridge

AcademiaML uses the GitHub Copilot SDK with the local signed-in CLI when it is available.

- The SDK path is discovered dynamically.
- The local CLI remains the source of authentication.
- When the bridge is not available or not authenticated, the UI should surface that clearly and keep Advisor mode usable.
