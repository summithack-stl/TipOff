# CAC cybersecurity reflection

Suggested submission text, based on the current implementation:

> We considered security by minimizing personal data and validating submissions on the server. TipOff requires no account, so we do not collect passwords. Our cleaned 311 dataset excludes caller identities and free-text descriptions. Photo reports collect an image, location and submission time; the public map shows block-level hotspots rather than individual report records. We use a secret-keyed HMAC of the sender’s connection to limit repeat contributions, reject duplicate photos, validate image size/type and supported locations, and rate-limit API calls. Provider keys stay on the server. Submitted images are processed by Groq and, when needed, Gemini. A limitation of our prototype is that uploaded photos and report records use public Blob URLs; we would move them to private storage with authorized access before accepting sensitive reports.

## Scope and limits

- This describes implemented protections, not a security certification or a claim that all stored data is private.
- Connection hashes do not establish a distinct person or residency; people sharing a connection can be grouped together.
- Rate limits and daily budgets are per server instance, not a distributed hard cap.
- Public Blob objects can be read by anyone with their URL; hiding records from the map is not storage access control.
- Private storage, photo metadata removal and a retention/deletion policy remain follow-up work.
