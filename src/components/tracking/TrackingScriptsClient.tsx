"use client";

import { useEffect, useState, useRef } from "react";

type TrackingData = {
    head: string[];
    bodyTop: string[];
    bodyBottom: string[];
};

/**
 * Client-side tracking code injector for "use client" layouts (CRM, Student).
 * Fetches enabled codes from the public API and renders them as raw HTML.
 */
export function TrackingScriptsClient({ site }: { site: "CRM" | "STUDENT" | "TAPLAI" }) {
    const [data, setData] = useState<TrackingData | null>(null);
    const fetchedRef = useRef(false);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        fetch(`/api/tracking-codes?site=${site}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((json: TrackingData | null) => {
                if (json) setData(json);
            })
            .catch(() => undefined);
    }, [site]);

    if (!data) return null;

    const allSnippets = [...data.head, ...data.bodyTop, ...data.bodyBottom];
    if (allSnippets.length === 0) return null;

    return (
        <>
            {allSnippets.map((snippet, i) => (
                <div
                    key={`tracking-${site}-${i}`}
                    suppressHydrationWarning
                    dangerouslySetInnerHTML={{ __html: snippet }}
                />
            ))}
        </>
    );
}
