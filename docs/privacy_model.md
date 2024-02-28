# Privacy model

Default remote payload:

- dataset row count
- column names
- inferred column types
- simple numeric summary statistics
- up to 5 sampled rows that are shown to the user

Anything beyond the visible sample should require explicit approval in the queue before it is sent to an external model provider.
