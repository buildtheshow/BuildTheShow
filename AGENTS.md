# Build The Show UI rules

## Time display

- Display every time as `h:mmam` or `h:mmpm` in lowercase, with no space before `am` or `pm` (for example, `9:00am`).
- Display a time range as `h:mmam - h:mmpm`, using a spaced hyphen (for example, `9:00am - 6:00pm`).
- Do not use locale-generated time strings, uppercase meridiems, `a.m.` / `p.m.`, en dashes, or “to” between displayed times.
- Use the shared `BTSFormatTime` and `BTSFormatTimeRange` helpers for display output. Preserve the source time and timezone semantics when formatting.
- Native time input controls may retain the browser's native editor; all surrounding labels, summaries, cards, and rendered values must follow this rule.
