"use client";

import { useState, useEffect } from "react";
import { TopBar } from "@/components/layout/TopBar";
import {
  Mail, Key, Webhook, Building2, Signature, Clock, Users,
  CheckCircle, AlertCircle, Eye, EyeOff, Save, Zap, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

const SECTIONS = [
  { id: "integrations", label: "Integrations" },
  { id: "ai", label: "AI Configuration" },
  { id: "company", label: "Company" },
  { id: "email", label: "Email" },
  { id: "team", label: "Team" },
];

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-4 border-b border-[hsl(var(--border))] last:border-0">
      <div className="max-w-xs">
        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{label}</p>
        {description && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{description}</p>}
      </div>
      <div className="ml-6 flex-1 max-w-sm">{children}</div>
    </div>
  );
}

function MaskedInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange?: (value: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={!onChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 pr-9 text-sm bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-md text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

const DEFAULT_PROMPT = `You are a professional cold email writer for ${BRAND.companyFullName}, a ${BRAND.agencyType}. Write personalised, concise emails that highlight the specific problems with the prospect's website and how we can help improve their online presence and conversions.`;

const DEFAULT_SIGNATURE = `Kind regards,

[Your Name]
Apex Digital AU
📞 +61 2 XXXX XXXX
🌐 www.apexdigital.com.au`;

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("integrations");
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);

  // AI configuration. The API-key boxes deliberately start empty and are only sent when
  // the user types a new key — so a blank box never overwrites the stored one, and the
  // key itself never has to come back down to the browser. The GET redacts them anyway
  // and reports has_*_key instead.
  const [defaultPrompt, setDefaultPrompt] = useState(DEFAULT_PROMPT);
  const [claudeKey, setClaudeKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [hasClaudeKey, setHasClaudeKey] = useState(false);
  const [hasOpenaiKey, setHasOpenaiKey] = useState(false);

  // Integrations
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState("");

  // Company
  const [companyName, setCompanyName] = useState(BRAND.companyFullName);
  const [hoursStart, setHoursStart] = useState("09:00");
  const [hoursEnd, setHoursEnd] = useState("17:00");

  // Email
  const [emailSignature, setEmailSignature] = useState(DEFAULT_SIGNATURE);

  // Saving is blocked until the initial load lands, otherwise a quick click would
  // persist the placeholder values over whatever is already stored.
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setGmailConnected(!!data?.gmail_connected);
          setGmailEmail(data?.gmail_email ?? null);
          if (data?.default_prompt) setDefaultPrompt(data.default_prompt);
          if (data?.n8n_webhook_url) setN8nWebhookUrl(data.n8n_webhook_url);
          if (data?.company_name) setCompanyName(data.company_name);
          if (data?.business_hours_start) setHoursStart(data.business_hours_start);
          if (data?.business_hours_end) setHoursEnd(data.business_hours_end);
          if (data?.email_signature) setEmailSignature(data.email_signature);
          // The keys themselves are redacted to null; only their presence comes back.
          setHasClaudeKey(!!data?.has_claude_key);
          setHasOpenaiKey(!!data?.has_openai_key);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoaded(true);
      }
    }
    loadSettings();

    // Show toast-style feedback from OAuth redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail_connected')) {
      setGmailConnected(true);
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  // Each section saves only its own fields, so hitting Save on Company can't overwrite
  // anything the user has half-typed under AI. Team has nothing persistable.
  function payloadFor(section: string): Record<string, string> {
    switch (section) {
      case "integrations":
        // The Webhook Secret box has no column on the settings table yet — see
        // migration-add-n8n-webhook-secret.sql — so it is deliberately not sent.
        return { n8n_webhook_url: n8nWebhookUrl };
      case "ai": {
        // Only send a key when one was actually typed: an empty box means "leave the
        // stored key alone", not "clear it".
        const payload: Record<string, string> = { default_prompt: defaultPrompt };
        if (claudeKey.trim()) payload.claude_api_key = claudeKey.trim();
        if (openaiKey.trim()) payload.openai_api_key = openaiKey.trim();
        return payload;
      }
      case "company":
        return {
          company_name: companyName,
          business_hours_start: hoursStart,
          business_hours_end: hoursEnd,
        };
      case "email":
        return { email_signature: emailSignature };
      default:
        return {};
    }
  }

  const savable = Object.keys(payloadFor(activeSection)).length > 0;

  async function handleSave() {
    const payload = payloadFor(activeSection);
    if (Object.keys(payload).length === 0) return;

    setSaving(true);
    setSaved(false);
    setSaveError(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setSaveError(data?.error ?? 'Could not save settings.');
        return;
      }

      // Keys are write-only from here: clear the boxes and just remember that one is set.
      if (payload.claude_api_key) { setClaudeKey(""); setHasClaudeKey(true); }
      if (payload.openai_api_key) { setOpenaiKey(""); setHasOpenaiKey(true); }
      setSaved(true);
    } catch {
      setSaveError('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Settings" subtitle="Configure your CRM workspace" />

      <div className="flex-1 flex overflow-hidden">
        {/* Settings sidebar */}
        <div className="w-48 border-r border-[hsl(var(--border))] p-3 space-y-0.5 shrink-0">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "w-full text-left text-sm px-3 py-2 rounded-md transition-colors",
                activeSection === s.id
                  ? "bg-[hsl(var(--primary))] text-white font-medium"
                  : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeSection === "integrations" && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-base font-semibold text-[hsl(var(--foreground))] mb-1">Integrations</h2>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Connect external services to your CRM</p>
              </div>

              {/* Gmail */}
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <Mail className="w-4 h-4 text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Google Workspace / Gmail</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Send and receive emails within the CRM</p>
                    </div>
                  </div>
                  {gmailConnected ? (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-full font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />Connected{gmailEmail ? ` (${gmailEmail})` : ''}
                    </span>
                  ) : (
                    <a href="/api/auth/gmail" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[hsl(var(--primary))] text-white hover:opacity-90 font-medium">
                      Connect Gmail
                    </a>
                  )}
                </div>
                {!gmailConnected && (
                  <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-400">Gmail is not connected. Connect your account to send emails and sync inbox directly from the CRM.</p>
                  </div>
                )}
              </div>

              {/* n8n */}
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Webhook className="w-4 h-4 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))]">n8n Automation</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Automate lead imports, status updates and follow-ups</p>
                  </div>
                </div>
                <SettingRow label="n8n Webhook URL" description="Your n8n instance webhook endpoint">
                  <input
                    type="url"
                    value={n8nWebhookUrl}
                    onChange={(e) => setN8nWebhookUrl(e.target.value)}
                    placeholder="https://your-n8n.com/webhook/apex-crm"
                    className="w-full px-3 py-2 text-sm bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-md text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  />
                </SettingRow>
                <SettingRow label="Webhook Secret" description="Needs a database column before it can be saved">
                  <div>
                    <MaskedInput value="" placeholder="whsec_..." />
                    <p className="text-[11px] text-amber-500 mt-1.5">
                      Not saved yet — run migration-add-n8n-webhook-secret.sql to enable.
                    </p>
                  </div>
                </SettingRow>
              </div>
            </div>
          )}

          {activeSection === "ai" && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-base font-semibold text-[hsl(var(--foreground))] mb-1">AI Configuration</h2>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Configure AI models for email writing and website analysis</p>
              </div>

              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] divide-y divide-[hsl(var(--border))]">
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-4 h-4 text-violet-400" />
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Claude API (Anthropic)</p>
                    <span className="text-[10px] bg-violet-500/15 text-violet-400 px-2 py-0.5 rounded-full font-medium">Primary</span>
                  </div>
                  <SettingRow label="API Key" description="Used for email generation and analysis">
                    <MaskedInput
                      value={claudeKey}
                      onChange={setClaudeKey}
                      placeholder={hasClaudeKey ? "Key saved — enter a new one to replace it" : "sk-ant-..."}
                    />
                  </SettingRow>
                </div>

                <div className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Key className="w-4 h-4 text-emerald-400" />
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))]">OpenAI API</p>
                    <span className="text-[10px] bg-slate-500/15 text-slate-400 px-2 py-0.5 rounded-full font-medium">Fallback</span>
                  </div>
                  <SettingRow label="API Key" description="Backup AI provider">
                    <MaskedInput
                      value={openaiKey}
                      onChange={setOpenaiKey}
                      placeholder={hasOpenaiKey ? "Key saved — enter a new one to replace it" : "sk-..."}
                    />
                  </SettingRow>
                </div>

                <div className="px-5 py-4">
                  <SettingRow label="Default Email Prompt" description="Base context sent to AI when generating emails">
                    <textarea
                      rows={5}
                      value={defaultPrompt}
                      onChange={(e) => setDefaultPrompt(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-md text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none"
                    />
                  </SettingRow>
                </div>
              </div>
            </div>
          )}

          {activeSection === "company" && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-base font-semibold text-[hsl(var(--foreground))] mb-1">Company Settings</h2>
              </div>
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 divide-y divide-[hsl(var(--border))]">
                <SettingRow label="Company Name">
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-md text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  />
                </SettingRow>
                <SettingRow label="Business Hours">
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={hoursStart}
                      onChange={(e) => setHoursStart(e.target.value)}
                      className="px-2 py-1.5 text-sm bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded text-[hsl(var(--foreground))] focus:outline-none"
                    />
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">to</span>
                    <input
                      type="time"
                      value={hoursEnd}
                      onChange={(e) => setHoursEnd(e.target.value)}
                      className="px-2 py-1.5 text-sm bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded text-[hsl(var(--foreground))] focus:outline-none"
                    />
                  </div>
                </SettingRow>
              </div>
            </div>
          )}

          {activeSection === "email" && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-base font-semibold text-[hsl(var(--foreground))] mb-1">Email Settings</h2>
              </div>
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 divide-y divide-[hsl(var(--border))]">
                <SettingRow label="Email Signature" description="Appended to all outbound emails">
                  <textarea
                    rows={6}
                    value={emailSignature}
                    onChange={(e) => setEmailSignature(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-md text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none font-mono"
                  />
                </SettingRow>
              </div>
            </div>
          )}

          {activeSection === "team" && (
            <div className="max-w-2xl">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[hsl(var(--foreground))] mb-1">Team Members</h2>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Manage access to the CRM</p>
                </div>
                <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[hsl(var(--primary))] text-white hover:opacity-90 font-medium">
                  <Users className="w-3.5 h-3.5" />
                  Invite Member
                </button>
              </div>
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] divide-y divide-[hsl(var(--border))]">
                {[{ name: "Admin", email: "apex@apexdigital.com.au", role: "Admin" }].map(member => (
                  <div key={member.email} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white">
                        {member.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{member.name}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{member.email}</p>
                      </div>
                    </div>
                    <span className="text-xs bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] px-2.5 py-1 rounded-full font-medium">{member.role}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save persists only the active section's fields. Hidden on Team, which has
              nothing to store. */}
          <div className={cn("mt-6 max-w-2xl", !savable && "hidden")}>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={!loaded || saving}
                className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-md bg-[hsl(var(--primary))] text-white hover:opacity-90 transition-opacity font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving…" : "Save Changes"}
              </button>

              {saved && !saveError && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Saved
                </span>
              )}
              {saveError && (
                <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {saveError}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
