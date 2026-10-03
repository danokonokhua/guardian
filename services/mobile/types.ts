export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: PushSubscriptionKeys;
  userAgent?: string | null;
}

export interface MobileNotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
}

export interface MobileDeviceSummary {
  id: string;
  endpoint: string;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MobileHubOverview {
  deviceCount: number;
  devices: MobileDeviceSummary[];
  vapidPublicKey: string;
}

export interface PushSendResult {
  endpoint: string;
  success: boolean;
  statusCode?: number;
  error?: string;
}

