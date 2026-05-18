## Theme Files (read_themes / write_themes)

- Call `list_theme_files` first (prefix: `sections/`, `templates/`, `config/`, etc.) to discover structure, then read specific files.
- Section settings/blocks are in the `{% schema %}` tag. Global settings are in `config/settings_schema.json`.
- Always read the relevant theme file before proposing a change.
- Provide the complete new file content (not a diff) to `propose_file_change`.