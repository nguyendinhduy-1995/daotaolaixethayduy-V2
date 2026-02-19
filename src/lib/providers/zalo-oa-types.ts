/**
 * Zalo OA API v3 Type Definitions
 * Reference: https://developers.zalo.me/docs/api/official-account-api
 */

/** ZNS Template Message Request */
export interface ZNSRequest {
    phone: string;           // Phone with country code (84xxx)
    templateId: string;      // ZNS template ID (approved by Zalo)
    templateData: Record<string, string>;  // Key-value params for template
    trackingId?: string;     // Optional tracking ID for delivery status
}

/** ZNS API Response */
export interface ZNSResponse {
    error: number;           // 0 = success
    message: string;         // Error message
    data?: {
        msg_id: string;        // Zalo message ID
        sent_time: string;     // ISO timestamp
        quota?: {
            dailyQuota: string;
            remainingQuota: string;
        };
    };
}

/** Text Message via OA */
export interface OATextRequest {
    recipientId: string;     // Zalo user ID
    text: string;            // Message text (max 2000 chars)
}

/** OA Text Response */
export interface OATextResponse {
    error: number;
    message: string;
    data?: {
        message_id: string;
    };
}

/** Delivery Status */
export type DeliveryStatus = "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "REJECTED";

/** Delivery callback payload */
export interface DeliveryCallback {
    msgId: string;
    status: DeliveryStatus;
    errorCode?: number;
    errorMessage?: string;
    timestamp: string;
}

/** ZaloOA config */
export interface ZaloOAConfig {
    appId: string;
    secretKey: string;
    accessToken: string;     // From env ZALO_OA_ACCESS_TOKEN
    refreshToken?: string;   // For auto-refresh
    dryRun: boolean;         // If true, log instead of sending
    maxRetries: number;      // Default: 3
    retryDelayMs: number;    // Default: 30000
    dailyLimit: number;      // Default: 500
}
