Fix Ask AI reading context and verse actions.

- Ask AI carries the displayed chapter or document, including personal study pages and chapters loaded on demand.
- The family server retrieves exact chapters before related sources and supplies the verse anchors to the assistant.
- Requested verse notes and highlights must produce app actions; invalid references are rejected before saving.
- Notes remain private and use the existing annotation sync. No full-vault download is needed.

The server retrieval update is installed separately on the family server. Reload Scripture Graph after updating the plugin.
