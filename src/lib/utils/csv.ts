/**
 * CSV Export Utility
 *
 * Converts an array of objects to CSV string format with proper escaping.
 * Supports Vietnamese characters and Excel-compatible BOM prefix.
 */

type CsvValue = string | number | boolean | null | undefined | Date;

function escapeCsvField(value: CsvValue): string {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString();
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export type CsvColumn<T> = {
    key: keyof T | ((row: T) => CsvValue);
    label: string;
};

export function toCsv<T extends Record<string, unknown>>(
    rows: T[],
    columns: CsvColumn<T>[]
): string {
    const headerLine = columns.map((col) => escapeCsvField(col.label)).join(",");

    const dataLines = rows.map((row) =>
        columns
            .map((col) => {
                const value = typeof col.key === "function" ? col.key(row) : row[col.key as string];
                return escapeCsvField(value as CsvValue);
            })
            .join(",")
    );

    // BOM for Excel UTF-8 compatibility
    return "\uFEFF" + [headerLine, ...dataLines].join("\r\n");
}

export function csvResponse(csvContent: string, filename: string): Response {
    return new Response(csvContent, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    });
}
