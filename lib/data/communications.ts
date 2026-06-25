export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed" | "cancelled";
export type CampaignType =
  | "welcome" | "verification" | "newsletter" | "campaign_update"
  | "donation_receipt" | "volunteer_confirmation" | "event_invitation"
  | "graatek_notification" | "idea_update" | "password_reset"
  | "magazine_digest" | "maintenance" | "announcement"
  | "fundraising" | "reengagement";
export type AudienceSegment =
  | "all" | "arabic" | "french" | "english"
  | "donors" | "volunteers" | "graatek" | "ideas"
  | "inactive" | "new_users" | "premium";
export type CampaignLanguage = "all" | "ar" | "fr" | "en";
export type DeliveryHealthStatus = "healthy" | "warning" | "critical";

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  type: CampaignType;
  audience: AudienceSegment;
  language: CampaignLanguage;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  status: CampaignStatus;
  created_at: string;
  scheduled_at: string | null;
  recurrence: "none" | "weekly" | "monthly" | null;
}

export interface AudienceSegmentInfo {
  id: AudienceSegment;
  name: string;
  count: number;
  growth: string;
}

export interface EmailTemplateItem {
  id: string;
  name: string;
  description: string;
  availableLanguages: CampaignLanguage[];
  thumbnail: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  target: string;
  user: string;
  timestamp: string;
  type: "sent" | "scheduled" | "created" | "failed" | "draft" | "cancelled";
}

export interface AnalyticsDataPoint {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
}

export interface DeliveryHealthMetric {
  labelKey: string;
  label: string;
  status: DeliveryHealthStatus;
  valueKey: string;
  value: string;
  detailKey: string;
  detail: string;
}

export interface CampaignAnalytics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  openRate: number;
  clickRate: number;
  deliveryRate: number;
  bounceRate: number;
  engagementRate: number;
}

const now = Date.now();
const day = 86400000;

export const mockCampaigns: EmailCampaign[] = [
  { id: "c1", name: "Monthly Newsletter – June 2026", subject: "Your monthly dose of community news", type: "newsletter", audience: "all", language: "all", sent: 12840, opened: 6741, clicked: 2153, bounced: 89, status: "sent", created_at: new Date(now - 2 * day).toISOString(), scheduled_at: null, recurrence: "monthly" },
  { id: "c2", name: "Water Campaign Fundraiser", subject: "Help us bring clean water to Nouadhibou", type: "fundraising", audience: "donors", language: "all", sent: 3421, opened: 2013, clicked: 876, bounced: 23, status: "sent", created_at: new Date(now - 5 * day).toISOString(), scheduled_at: null, recurrence: null },
  { id: "c3", name: "Volunteer Appreciation Week", subject: "You're invited! Volunteer appreciation event", type: "volunteer_confirmation", audience: "volunteers", language: "fr", sent: 892, opened: 612, clicked: 389, bounced: 4, status: "sent", created_at: new Date(now - 7 * day).toISOString(), scheduled_at: null, recurrence: null },
  { id: "c4", name: "New Feature: Community Stories", subject: "Check out the new Stories feature!", type: "announcement", audience: "all", language: "en", sent: 0, opened: 0, clicked: 0, bounced: 0, status: "draft", created_at: new Date(now - 1 * day).toISOString(), scheduled_at: null, recurrence: null },
  { id: "c5", name: "Ramadan 2026 Campaign", subject: "Spread kindness this Ramadan", type: "campaign_update", audience: "arabic", language: "ar", sent: 0, opened: 0, clicked: 0, bounced: 0, status: "scheduled", created_at: new Date(now - 3 * day).toISOString(), scheduled_at: new Date(now + 14 * day).toISOString(), recurrence: null },
  { id: "c6", name: "Graatek Exchange Notification", subject: "Your Graatek request has been matched!", type: "graatek_notification", audience: "graatek", language: "all", sent: 0, opened: 0, clicked: 0, bounced: 0, status: "scheduled", created_at: new Date(now - 4 * day).toISOString(), scheduled_at: new Date(now + 1 * day).toISOString(), recurrence: null },
  { id: "c7", name: "Weekly Digest – Week 25", subject: "Top stories from this week", type: "newsletter", audience: "all", language: "all", sent: 12500, opened: 5875, clicked: 1750, bounced: 112, status: "sent", created_at: new Date(now - 9 * day).toISOString(), scheduled_at: null, recurrence: "weekly" },
  { id: "c8", name: "IDEA Platform Update", subject: "New ideas need your votes!", type: "idea_update", audience: "ideas", language: "en", sent: 2150, opened: 1398, clicked: 645, bounced: 10, status: "sent", created_at: new Date(now - 12 * day).toISOString(), scheduled_at: null, recurrence: null },
  { id: "c9", name: "Welcome – New Members June", subject: "Welcome to I ❤️ NDB Community!", type: "welcome", audience: "new_users", language: "all", sent: 456, opened: 342, clicked: 267, bounced: 5, status: "sending", created_at: new Date(now - 1 * day).toISOString(), scheduled_at: null, recurrence: null },
  { id: "c10", name: "Maintenance Scheduled", subject: "Platform maintenance on July 2nd", type: "maintenance", audience: "all", language: "all", sent: 0, opened: 0, clicked: 0, bounced: 0, status: "draft", created_at: new Date(now - 0.5 * day).toISOString(), scheduled_at: null, recurrence: null },
  { id: "c11", name: "Re-engagement Campaign", subject: "We miss you! Come back to the community", type: "reengagement", audience: "inactive", language: "fr", sent: 3200, opened: 896, clicked: 312, bounced: 98, status: "sent", created_at: new Date(now - 20 * day).toISOString(), scheduled_at: null, recurrence: null },
  { id: "c12", name: "Donation Receipt – June", subject: "Thank you for your donation!", type: "donation_receipt", audience: "donors", language: "all", sent: 0, opened: 0, clicked: 0, bounced: 0, status: "failed", created_at: new Date(now - 3 * day).toISOString(), scheduled_at: null, recurrence: null },
  { id: "c13", name: "Magazine: Summer 2026", subject: "Summer 2026 Magazine is here!", type: "magazine_digest", audience: "all", language: "fr", sent: 9500, opened: 4275, clicked: 1520, bounced: 76, status: "sent", created_at: new Date(now - 15 * day).toISOString(), scheduled_at: null, recurrence: null },
  { id: "c14", name: "Password Reset Alert", subject: "Your password was reset", type: "password_reset", audience: "all", language: "all", sent: 234, opened: 0, clicked: 0, bounced: 2, status: "sent", created_at: new Date(now - 6 * day).toISOString(), scheduled_at: null, recurrence: null },
  { id: "c15", name: "Event: Beach Cleanup", subject: "Join us for a beach cleanup!", type: "event_invitation", audience: "volunteers", language: "ar", sent: 0, opened: 0, clicked: 0, bounced: 0, status: "cancelled", created_at: new Date(now - 10 * day).toISOString(), scheduled_at: new Date(now - 2 * day).toISOString(), recurrence: null },
];

export const audienceSegments: AudienceSegmentInfo[] = [
  { id: "all", name: "All Users", count: 24850, growth: "+12.4%" },
  { id: "arabic", name: "Arabic Users", count: 12420, growth: "+8.2%" },
  { id: "french", name: "French Users", count: 8930, growth: "+15.7%" },
  { id: "english", name: "English Users", count: 3500, growth: "+5.1%" },
  { id: "donors", name: "Donors", count: 4280, growth: "+22.3%" },
  { id: "volunteers", name: "Volunteers", count: 3150, growth: "+18.9%" },
  { id: "graatek", name: "Graatek Users", count: 1870, growth: "+34.2%" },
  { id: "ideas", name: "Idea Participants", count: 2340, growth: "+9.6%" },
  { id: "inactive", name: "Inactive (90d)", count: 6540, growth: "-2.1%" },
  { id: "new_users", name: "New (30d)", count: 1120, growth: "+45.8%" },
  { id: "premium", name: "Premium Members", count: 890, growth: "+67.3%" },
];

export const emailTemplates: EmailTemplateItem[] = [
  { id: "t1", name: "New Campaign Launch", description: "Bold announcement with hero image, CTA button, and social links", availableLanguages: ["ar", "fr", "en"], thumbnail: "campaign" },
  { id: "t2", name: "Volunteer Reminder", description: "Friendly reminder with event details and RSVP button", availableLanguages: ["ar", "fr", "en"], thumbnail: "volunteer" },
  { id: "t3", name: "Donation Verified", description: "Thank-you receipt with donation summary and impact story", availableLanguages: ["ar", "fr", "en"], thumbnail: "donation" },
  { id: "t4", name: "Newsletter Digest", description: "Multi-section layout with featured articles and quick links", availableLanguages: ["ar", "fr", "en"], thumbnail: "newsletter" },
  { id: "t5", name: "Event Invitation", description: "Event card with date, location, map link, and attendee count", availableLanguages: ["ar", "fr", "en"], thumbnail: "event" },
  { id: "t6", name: "Re-engagement", description: "We-miss-you message with personalised content suggestions", availableLanguages: ["ar", "fr", "en"], thumbnail: "reengage" },
];

export const campaignTypes: { value: CampaignType; label: string }[] = [
  { value: "welcome", label: "Welcome Email" },
  { value: "verification", label: "Verification" },
  { value: "newsletter", label: "Newsletter" },
  { value: "campaign_update", label: "Campaign Update" },
  { value: "donation_receipt", label: "Donation Receipt" },
  { value: "volunteer_confirmation", label: "Volunteer Confirmation" },
  { value: "event_invitation", label: "Event Invitation" },
  { value: "graatek_notification", label: "Graatek Notification" },
  { value: "idea_update", label: "Idea Update" },
  { value: "password_reset", label: "Password Reset" },
  { value: "magazine_digest", label: "Magazine Digest" },
  { value: "maintenance", label: "Maintenance Notice" },
  { value: "announcement", label: "Announcement" },
  { value: "fundraising", label: "Fundraising" },
  { value: "reengagement", label: "Re-engagement" },
];

export const recentActivity: ActivityItem[] = [
  { id: "a1", action: "sent", target: "Monthly Newsletter – June 2026", user: "Admin", timestamp: new Date(now - 2 * day).toISOString(), type: "sent" },
  { id: "a2", action: "scheduled", target: "Ramadan 2026 Campaign", user: "Admin", timestamp: new Date(now - 3 * day).toISOString(), type: "scheduled" },
  { id: "a3", action: "created", target: "New Feature: Community Stories", user: "Sarah K.", timestamp: new Date(now - 1 * day).toISOString(), type: "draft" },
  { id: "a4", action: "failed", target: "Donation Receipt – June", user: "System", timestamp: new Date(now - 3 * day).toISOString(), type: "failed" },
  { id: "a5", action: "sent", target: "Water Campaign Fundraiser", user: "Admin", timestamp: new Date(now - 5 * day).toISOString(), type: "sent" },
  { id: "a6", action: "sent", target: "Welcome – New Members June", user: "Automation", timestamp: new Date(now - 1 * day).toISOString(), type: "sent" },
  { id: "a7", action: "scheduled", target: "Graatek Exchange Notification", user: "Admin", timestamp: new Date(now - 4 * day).toISOString(), type: "scheduled" },
  { id: "a8", action: "cancelled", target: "Event: Beach Cleanup", user: "Admin", timestamp: new Date(now - 10 * day).toISOString(), type: "cancelled" },
  { id: "a9", action: "sent", target: "Magazine: Summer 2026", user: "Content Team", timestamp: new Date(now - 15 * day).toISOString(), type: "sent" },
  { id: "a10", action: "created", target: "Maintenance Scheduled", user: "Tech Admin", timestamp: new Date(now - 0.5 * day).toISOString(), type: "draft" },
];

export function mockAnalytics(): { trends: AnalyticsDataPoint[]; topCampaigns: { name: string; sent: number; openRate: number }[]; kpis: CampaignAnalytics } {
  const trends: AnalyticsDataPoint[] = Array.from({ length: 30 }, (_, i) => {
    const dayOffset = 29 - i;
    const base = Math.max(200, 800 - i * 18 + Math.round(Math.random() * 120));
    return {
      date: new Date(now - dayOffset * day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      sent: base,
      opened: Math.round(base * (0.45 + Math.random() * 0.15)),
      clicked: Math.round(base * (0.12 + Math.random() * 0.10)),
      bounced: Math.round(base * (0.005 + Math.random() * 0.025)),
    };
  });
  const totalSent = trends.reduce((s, d) => s + d.sent, 0);
  const totalOpened = trends.reduce((s, d) => s + d.opened, 0);
  const totalClicked = trends.reduce((s, d) => s + d.clicked, 0);
  const totalBounced = trends.reduce((s, d) => s + d.bounced, 0);
  return {
    trends,
    topCampaigns: [
      { name: "Monthly Newsletter – June 2026", sent: 12840, openRate: 52.5 },
      { name: "Magazine: Summer 2026", sent: 9500, openRate: 45.0 },
      { name: "Weekly Digest – Week 25", sent: 12500, openRate: 47.0 },
      { name: "IDEA Platform Update", sent: 2150, openRate: 65.0 },
      { name: "Water Campaign Fundraiser", sent: 3421, openRate: 58.8 },
    ],
    kpis: {
      sent: totalSent,
      delivered: totalSent - totalBounced,
      opened: totalOpened,
      clicked: totalClicked,
      bounced: totalBounced,
      complained: Math.round(totalSent * 0.001),
      openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 10000) / 100 : 0,
      clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 10000) / 100 : 0,
      deliveryRate: totalSent > 0 ? Math.round(((totalSent - totalBounced) / totalSent) * 10000) / 100 : 0,
      bounceRate: totalSent > 0 ? Math.round((totalBounced / totalSent) * 10000) / 100 : 0,
      engagementRate: totalSent > 0 ? Math.round(((totalOpened + totalClicked) / (totalSent * 2)) * 10000) / 100 : 0,
    },
  };
}

export const deliveryHealthMetrics: DeliveryHealthMetric[] = [
  { labelKey: "dhSmtpServer", label: "SMTP Server", status: "healthy", valueKey: "dhOperational", value: "Operational", detailKey: "dhSmtpDetail", detail: "99.9% uptime (30d)" },
  { labelKey: "dhBounceRate", label: "Bounce Rate", status: "warning", valueKey: "dhBounceValue", value: "2.1%", detailKey: "dhBounceDetail", detail: "Above 2% threshold" },
  { labelKey: "dhSpamComplaints", label: "Spam Complaints", status: "healthy", valueKey: "dhSpamValue", value: "0.03%", detailKey: "dhSpamDetail", detail: "Below 0.1% threshold" },
  { labelKey: "dhQueueDepth", label: "Queue Depth", status: "healthy", valueKey: "dhQueueValue", value: "12 emails", detailKey: "dhQueueDetail", detail: "Processing normally" },
  { labelKey: "dhDkimSpf", label: "DKIM/SPF", status: "healthy", valueKey: "dhDkimValue", value: "Passing", detailKey: "dhDkimDetail", detail: "All records verified" },
  { labelKey: "dhDeliveryLatency", label: "Delivery Latency", status: "warning", valueKey: "dhLatencyValue", value: "4.2s avg", detailKey: "dhLatencyDetail", detail: "Above 3s baseline" },
  { labelKey: "dhBlacklist", label: "Blacklist Status", status: "critical", valueKey: "dhBlacklistValue", value: "Listed on 1", detailKey: "dhBlacklistDetail", detail: "ZenSpam – investigation needed" },
  { labelKey: "dhRateLimiting", label: "Rate Limiting", status: "healthy", valueKey: "dhRateValue", value: "No throttling", detailKey: "dhRateDetail", detail: "Within SendGrid limits" },
];

export const audienceSegmentNames: Record<AudienceSegment, string> = {
  all: "All", arabic: "Arabic", french: "French", english: "English",
  donors: "Donors", volunteers: "Volunteers", graatek: "Graatek",
  ideas: "Ideas", inactive: "Inactive", new_users: "New Users", premium: "Premium",
};

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US").format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
