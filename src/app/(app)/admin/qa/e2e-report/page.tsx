"use client";

import { useEffect, useState } from "react";

interface TestCase {
    name: string;
    status: string;
    duration: number;
    file: string;
}

interface Snapshot {
    name: string;
    size: number;
    modified: string;
}

interface E2EReport {
    lastRun: string;
    summary: { total: number; passed: number; failed: number; skipped: number };
    htmlReportAvailable: boolean;
    testCases: TestCase[];
    snapshots: Snapshot[];
}

export default function E2EReportPage() {
    const [report, setReport] = useState<E2EReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/admin/qa/e2e-results")
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => setReport(data))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-6 text-gray-400">Đang tải kết quả E2E...</div>;
    if (error) return <div className="p-6 text-red-400">Lỗi: {error}</div>;
    if (!report) return <div className="p-6 text-gray-400">Không có dữ liệu</div>;

    const { summary, testCases, snapshots, lastRun, htmlReportAvailable } = report;
    const passRate = summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 0;

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">📊 E2E Test Report</h1>
                <span className="text-sm text-gray-400">
                    Lần chạy cuối: {new Date(lastRun).toLocaleString("vi-VN")}
                </span>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard label="Tổng tests" value={summary.total} color="text-blue-400" />
                <SummaryCard label="Passed" value={summary.passed} color="text-green-400" />
                <SummaryCard label="Failed" value={summary.failed} color="text-red-400" />
                <SummaryCard label="Pass Rate" value={`${passRate}%`} color={passRate >= 80 ? "text-green-400" : "text-yellow-400"} />
            </div>

            {/* HTML Report Link */}
            {htmlReportAvailable && (
                <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                    <p className="text-blue-300">
                        📄 HTML Report có sẵn. Chạy <code className="bg-gray-800 px-2 py-1 rounded text-sm">npx playwright show-report</code> để xem chi tiết.
                    </p>
                </div>
            )}

            {/* Test Cases Table */}
            <div>
                <h2 className="text-lg font-semibold text-white mb-3">Test Cases</h2>
                {testCases.length === 0 ? (
                    <p className="text-gray-500 text-sm">
                        Chưa có kết quả. Chạy <code className="bg-gray-800 px-2 py-1 rounded">npm run test:e2e</code> để tạo.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-gray-800 text-gray-300">
                                    <th className="text-left p-3">#</th>
                                    <th className="text-left p-3">Test Name</th>
                                    <th className="text-left p-3">Status</th>
                                    <th className="text-right p-3">Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                {testCases.map((tc, i) => (
                                    <tr key={i} className="border-b border-gray-700 hover:bg-gray-800/50">
                                        <td className="p-3 text-gray-500">{i + 1}</td>
                                        <td className="p-3 text-gray-200">{tc.name}</td>
                                        <td className="p-3">
                                            <StatusBadge status={tc.status} />
                                        </td>
                                        <td className="p-3 text-right text-gray-400">
                                            {tc.duration > 0 ? `${(tc.duration / 1000).toFixed(1)}s` : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Snapshots */}
            <div>
                <h2 className="text-lg font-semibold text-white mb-3">
                    📸 Screenshots ({snapshots.length})
                </h2>
                {snapshots.length === 0 ? (
                    <p className="text-gray-500 text-sm">Chưa có screenshots.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {snapshots.map((snap, i) => (
                            <div key={i} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                                <p className="text-sm text-gray-300 truncate" title={snap.name}>
                                    {snap.name}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {(snap.size / 1024).toFixed(1)} KB •{" "}
                                    {new Date(snap.modified).toLocaleString("vi-VN")}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* How to Run */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">🏃 Cách chạy E2E tests</h3>
                <pre className="text-xs text-gray-400 whitespace-pre-wrap">{`# Chạy tất cả
npm run test:e2e

# Chạy riêng CRM critical
npx playwright test tests/e2e/crm-critical.spec.ts

# Chạy responsive
npx playwright test tests/e2e/responsive.spec.ts

# Xem report HTML
npm run test:e2e:report`}</pre>
            </div>
        </div>
    );
}

function SummaryCard({ label, value, color }: { label: string; value: number | string; color: string }) {
    return (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
            <div className={`text-3xl font-bold ${color}`}>{value}</div>
            <div className="text-sm text-gray-400 mt-1">{label}</div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const cls =
        status === "passed"
            ? "bg-green-900/50 text-green-300 border-green-700"
            : status === "failed"
                ? "bg-red-900/50 text-red-300 border-red-700"
                : "bg-gray-700 text-gray-300 border-gray-600";
    return (
        <span className={`px-2 py-1 rounded text-xs border ${cls}`}>
            {status}
        </span>
    );
}
