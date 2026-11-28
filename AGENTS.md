# Build The Show UI rules

## Time display

- Display every time as `h:mmam` or `h:mmpm` in lowercase, with no space before `am` or `pm` (for example, `9:00am`).
- Display a time range as `h:mmam - h:mmpm`, using a spaced hyphen (for example, `9:00am - 6:00pm`).
- Do not use locale-generated time strings, uppercase meridiems, `a.m.` / `p.m.`, en dashes, or “to” between displayed times.
- Use the shared `BTSFormatTime` and `BTSFormatTimeRange` helpers for display output. Preserve the source time and timezone semantics when formatting.
- Native time input controls may retain the browser's native editor; all surrounding labels, summaries, cards, and rendered values must follow this rule.

## Icon consistency

- Reuse existing Build The Show artwork when a matching icon is available.
- Keep icons used together consistent in apparent size, alignment, and visual weight. Start with a shared stroke weight for outline icons at the same display size.
- Check icons next to one another at the sizes they actually render. Small outline icons may need thicker strokes for legibility. Solid or visually dense icons may need a slightly smaller drawing within the same icon box.
- Preserve each icon's proportions and recognizable shape. Keep larger icons visually proportional to their role and verify the balance at both desktop and mobile sizes when the layout changes.
