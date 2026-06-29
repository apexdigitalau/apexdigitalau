-- =============================================
-- APEX DIGITAL AU CRM - SUPABASE SCHEMA
-- Run this in your Supabase SQL editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USERS TABLE (extends Supabase auth.users)
-- =============================================
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'staff')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SETTINGS TABLE
-- =============================================
CREATE TABLE public.settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  gmail_connected BOOLEAN DEFAULT FALSE,
  gmail_email TEXT,
  gmail_refresh_token TEXT,
  claude_api_key TEXT,
  openai_api_key TEXT,
  n8n_webhook_url TEXT,
  company_name TEXT DEFAULT 'Apex Digital AU',
  company_logo TEXT,
  email_signature TEXT,
  default_prompt TEXT,
  business_hours_start TEXT DEFAULT '09:00',
  business_hours_end TEXT DEFAULT '17:00',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO public.settings (company_name) VALUES ('Apex Digital AU');

-- =============================================
-- LEADS TABLE
-- =============================================
CREATE TABLE public.leads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_name TEXT NOT NULL,
  industry TEXT,
  website TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  google_rating DECIMAL(2,1),
  contact_name TEXT,
  website_score INTEGER CHECK (website_score >= 0 AND website_score <= 100),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'ready_to_contact', 'email_sent', 'replied',
    'meeting_booked', 'proposal_sent', 'won', 'lost', 'archived'
  )),
  date_added DATE DEFAULT CURRENT_DATE,
  last_contacted TIMESTAMPTZ,
  follow_up_date DATE,
  assigned_user UUID REFERENCES public.users(id),
  notes TEXT,
  source TEXT, -- 'google_maps', 'directory', 'manual', 'csv'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for leads
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_date_added ON public.leads(date_added);
CREATE INDEX idx_leads_follow_up ON public.leads(follow_up_date);
CREATE INDEX idx_leads_company ON public.leads(company_name);
CREATE INDEX idx_leads_industry ON public.leads(industry);
CREATE UNIQUE INDEX idx_leads_website_dedup ON public.leads(website) WHERE website IS NOT NULL;

-- =============================================
-- WEBSITE ANALYSIS TABLE
-- =============================================
CREATE TABLE public.website_analyses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  design_score INTEGER CHECK (design_score >= 0 AND design_score <= 100),
  speed_score INTEGER CHECK (speed_score >= 0 AND speed_score <= 100),
  seo_score INTEGER CHECK (seo_score >= 0 AND seo_score <= 100),
  mobile_score INTEGER CHECK (mobile_score >= 0 AND mobile_score <= 100),
  accessibility_score INTEGER CHECK (accessibility_score >= 0 AND accessibility_score <= 100),
  trust_score INTEGER CHECK (trust_score >= 0 AND trust_score <= 100),
  cta_score INTEGER CHECK (cta_score >= 0 AND cta_score <= 100),
  ai_summary TEXT,
  issues JSONB DEFAULT '[]',
  improvements JSONB DEFAULT '[]',
  estimated_conversion_increase DECIMAL(5,2),
  screenshot_url TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analyses_lead ON public.website_analyses(lead_id);

-- =============================================
-- EMAIL CAMPAIGNS TABLE
-- =============================================
CREATE TABLE public.email_campaigns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused')),
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  spam_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.users(id),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- EMAILS TABLE
-- =============================================
CREATE TABLE public.emails (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  gmail_message_id TEXT UNIQUE,
  gmail_thread_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT,
  body_html TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'replied', 'bounced', 'spam', 'draft')),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_emails_lead ON public.emails(lead_id);
CREATE INDEX idx_emails_campaign ON public.emails(campaign_id);
CREATE INDEX idx_emails_thread ON public.emails(gmail_thread_id);
CREATE INDEX idx_emails_direction ON public.emails(direction);
CREATE INDEX idx_emails_status ON public.emails(status);

-- =============================================
-- EMAIL TEMPLATES TABLE
-- =============================================
CREATE TABLE public.email_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  subject TEXT,
  body TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  ai_generated BOOLEAN DEFAULT TRUE,
  sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CLIENTS TABLE
-- =============================================
CREATE TABLE public.clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  address TEXT,
  project_value DECIMAL(10,2),
  project_status TEXT DEFAULT 'active' CHECK (project_status IN ('active', 'completed', 'paused', 'cancelled')),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('reply', 'meeting', 'follow_up', 'analysis_complete', 'email_failed', 'lead_imported')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);

-- =============================================
-- ACTIVITY LOG TABLE
-- =============================================
CREATE TABLE public.activity_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_lead ON public.activity_log(lead_id);
CREATE INDEX idx_activity_created ON public.activity_log(created_at);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Policies - authenticated users can access all data
CREATE POLICY "Authenticated users can read leads" ON public.leads FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read analyses" ON public.website_analyses FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read campaigns" ON public.email_campaigns FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read emails" ON public.emails FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read templates" ON public.email_templates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read clients" ON public.clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read notifications" ON public.notifications FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read activity" ON public.activity_log FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read settings" ON public.settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can read users" ON public.users FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- SEED DATA (Optional demo leads)
-- =============================================
-- Insert sample leads for testing
INSERT INTO public.leads (company_name, industry, website, email, phone, google_rating, contact_name, status, notes) VALUES
('Smith & Sons Plumbing', 'Plumbing', 'https://smithsons.com.au', 'info@smithsons.com.au', '02 9123 4567', 3.8, 'John Smith', 'new', 'Old website, no mobile version'),
('Melbourne Dental Centre', 'Healthcare', 'https://melbournedental.com.au', 'hello@melbournedental.com.au', '03 8765 4321', 4.2, 'Dr. Sarah Lee', 'ready_to_contact', 'Slow loading, poor SEO'),
('Coastal Cafe & Bakery', 'Food & Beverage', 'https://coastalcafe.com.au', 'contact@coastalcafe.com.au', '07 5555 1234', 4.7, 'Emma Watson', 'email_sent', 'No online ordering, basic design'),
('TechStart Solutions', 'Technology', 'https://techstart.com.au', 'hello@techstart.com.au', '02 9999 8888', 4.0, 'Mike Chen', 'replied', 'Interested in redesign'),
('Green Gardens Landscaping', 'Landscaping', 'https://greengardens.com.au', 'info@greengardens.com.au', '03 4444 5555', 4.5, 'Tom Green', 'meeting_booked', 'Meeting Thursday 2pm'),
('Sydney Law Group', 'Legal', 'https://sydneylawgroup.com.au', 'contact@sydneylawgroup.com.au', '02 8888 7777', 4.1, 'James Morrison', 'won', 'Signed contract $8500'),
('Bella''s Beauty Studio', 'Beauty & Wellness', 'https://bellasbeauty.com.au', 'bella@bellasbeauty.com.au', '04 2222 3333', 4.8, 'Bella Romano', 'proposal_sent', 'Awaiting approval'),
('Quantum Real Estate', 'Real Estate', 'https://quantumre.com.au', 'team@quantumre.com.au', '02 7777 6666', 3.9, 'David Park', 'new', 'Multiple locations, needs major overhaul');
