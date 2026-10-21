/** Wrap physical text or a bound value without granting it execution capabilities. */
export function sourceFragment(text, origins = []) {
    return { segments: [{ text, origins }] };
}
/** Materialize only at a declared source-generation/parser boundary. */
export function fragmentText(fragment) {
    if (fragment.segments.length === 1) {
        return fragment.segments[0].text;
    }
    return fragment.segments.map((segment) => segment.text).join("");
}
/** Preserve each contributing occurrence when a later phase selects part of generated text. */
export function sliceSourceFragment(fragment, start, end) {
    if (start === 0 && fragment.segments.length === 1 && end === fragment.segments[0].text.length) {
        return fragment;
    }
    const segments = [];
    let offset = 0;
    for (const segment of fragment.segments) {
        const next = offset + segment.text.length;
        const from = Math.max(start, offset);
        const to = Math.min(end, next);
        if (from < to) {
            const localStart = from - offset;
            const localEnd = to - offset;
            // Narrow physical spans only when the segment is an exact occurrence of that text.
            // Generated/concatenated tokens retain all original contributing ranges instead.
            const origins = segment.origins.map((origin) => {
                const span = origin.span;
                if (span &&
                    span.end - span.start === segment.text.length &&
                    origin.text?.slice(span.start, span.end) === segment.text) {
                    return {
                        ...origin,
                        span: { ...span, start: span.start + localStart, end: span.start + localEnd },
                    };
                }
                return origin;
            });
            segments.push({ text: segment.text.slice(localStart, localEnd), origins });
        }
        offset = next;
        if (offset >= end) {
            break;
        }
    }
    return { segments };
}
/** Bind non-overlapping sites in source order; earlier-phase output may be parsed by a later phase. */
export function bindSourceFragment(fragment, replacements) {
    if (!replacements.length) {
        return fragment;
    }
    const segments = [];
    let cursor = 0;
    const length = fragment.segments.reduce((total, segment) => total + segment.text.length, 0);
    for (const replacement of replacements) {
        if (replacement.start < cursor ||
            replacement.end < replacement.start ||
            replacement.end > length) {
            throw new Error("Invalid source-fragment replacement range.");
        }
        segments.push(...sliceSourceFragment(fragment, cursor, replacement.start).segments);
        // Keep both the placeholder and value origins: concatenated identifiers can depend on either.
        const origins = sliceSourceFragment(fragment, replacement.start, replacement.end).segments.flatMap((part) => part.origins);
        for (const part of replacement.value.segments) {
            segments.push({ text: part.text, origins: [...new Set([...origins, ...part.origins])] });
        }
        cursor = replacement.end;
    }
    segments.push(...sliceSourceFragment(fragment, cursor, length).segments);
    return { segments };
}
//# sourceMappingURL=source-fragment.js.map