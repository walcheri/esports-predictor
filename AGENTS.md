# Architecture rules

- Keep Groq transport and model-availability recovery inside the prediction function's local helper; retry unavailable models only against the account's active catalog, preserving the preferred model and provider.