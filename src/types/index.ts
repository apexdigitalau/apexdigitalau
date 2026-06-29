export type LeadStatus =
  | 'new'
  | 'ready_to_contact'
  | 'email_sent'
  | 'replied'
  | 'meeting_booked'
  | 'proposal_sent'
  | 'won'
  | 'lost'
  | 'archived'

export interface Lead {
  id: string
  company_name: string
  industry: string | null
  website: string | null
  email: string | null
  phone: string | null
  address: string | null
  google_rating: number | null
  contact_name: string | null
  website_score: number | null
  status: LeadStatus
  date_added: string
  last_contacted: string | null
  follow_up_date: string | null
  assigned_user: string | null
  notes: string | null
  created_at: string
  updated_at: string
  email_count?: number
  website_analysis?: WebsiteAnalysis | null
}

export interface WebsiteAnalysis {
  id: string
  lead_id: string
  overall_score: number
  design_score: number
  speed_score: number
  seo_score: number
  mobile_score: number
  accessibility_score: number
  trust_score: number
  cta_score: number
  ai_summary: string | null
  issues: string[]
  improvements: string[]
  estimated_conversion_increase: number | null
  screenshot_url: string | null
  created_at: string
}

export interface EmailCampaign {
  id: string
  name: string
  subject: string
  body: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused'
  sent_count: number
  delivered_count: number
  opened_count: number
  replied_count: number
  bounced_count: number
  spam_count: number
  created_at: string
  sent_at: string | null
  scheduled_at: string | null
}

export interface Email {
  id: string
  lead_id: string | null
  campaign_id: string | null
  gmail_message_id: string | null
  gmail_thread_id: string | null
  direction: 'inbound' | 'outbound'
  from_email: string
  to_email: string
  subject: string
  body: string
  status: 'sent' | 'delivered' | 'opened' | 'replied' | 'bounced' | 'spam' | 'draft'
  sent_at: string | null
  opened_at: string | null
  replied_at: string | null
  created_at: string
  lead?: Lead
}

export interface Client {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  project_value: number | null
  project_status: 'active' | 'completed' | 'paused' | 'cancelled'
  start_date: string | null
  end_date: string | null
  notes: string | null
  lead_id: string | null
  created_at: string
}

export interface Notification {
  id: string
  type: 'reply' | 'meeting' | 'follow_up' | 'analysis_complete' | 'email_failed' | 'lead_imported'
  title: string
  message: string
  read: boolean
  lead_id: string | null
  created_at: string
}

export interface DashboardStats {
  leads_today: number
  emails_sent_today: number
  replies_received: number
  meetings_booked: number
  websites_sold: number
  revenue_this_month: number
  reply_rate: number
  open_rate: number
  conversion_rate: number
}

export interface ChartDataPoint {
  date: string
  value: number
  label?: string
}

export interface AnalyticsData {
  emails_sent: ChartDataPoint[]
  replies: ChartDataPoint[]
  sales: ChartDataPoint[]
  revenue: ChartDataPoint[]
  conversion_rate: number
  avg_deal_value: number
  monthly_growth: number
  top_industries: { industry: string; count: number; revenue: number }[]
}

export interface User {
  id: string
  email: string
  name: string | null
  role: 'admin' | 'staff'
  avatar_url: string | null
  created_at: string
}

export interface Settings {
  id: string
  gmail_connected: boolean
  gmail_email: string | null
  claude_api_key: string | null
  openai_api_key: string | null
  n8n_webhook_url: string | null
  company_name: string
  company_logo: string | null
  email_signature: string | null
  default_prompt: string | null
  business_hours_start: string
  business_hours_end: string
}
