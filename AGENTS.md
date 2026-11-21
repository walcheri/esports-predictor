# Architecture rules

- Keep Groq transport and model-availability recovery inside the prediction function's local helper; retry unavailable models only against the account's active catalog, preserving the preferred model and provider.
- Keep profile reads owner-scoped and enforce waitlist email, account ownership, and creation-time validation in database policies; guest waitlist submissions remain supported without exposing personal profiles.