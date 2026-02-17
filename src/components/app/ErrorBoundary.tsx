"use client";

import React, { Component, type ReactNode } from "react";

type Props = {
    children: ReactNode;
    fallback?: ReactNode;
};

type State = {
    hasError: boolean;
    error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error("[ErrorBoundary]", error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="flex min-h-[200px] items-center justify-center p-6">
                    <div className="w-full max-w-md rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
                        <p className="text-base font-semibold text-red-900">Đã xảy ra lỗi</p>
                        <p className="mt-2 text-sm text-red-700">
                            {this.state.error?.message || "Vui lòng tải lại trang."}
                        </p>
                        <button
                            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                            onClick={() => window.location.reload()}
                        >
                            Tải lại trang
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
