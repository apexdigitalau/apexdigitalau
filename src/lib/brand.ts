// ============================================================
// CLIENT BRANDING CONFIGURATION
// ============================================================
// This is the ONE file you edit when deploying this CRM for a
// new client. Change these values, redeploy, done.
//
// For colors, edit src/app/globals.css (see --primary etc.)
// ============================================================

export const BRAND = {
  // Company identity
  companyName: 'Apex Digital',
  companyFullName: 'Apex Digital AU',
  tagline: 'The central operating system for Apex Digital AU',

  // Shown in the browser tab
  pageTitle: 'Apex Digital AU — CRM',

  // Login page
  loginEmailPlaceholder: 'you@apexdigitalau.com',

  // Emails sent from the CRM use this as the sender display name
  emailSenderName: 'Apex Digital',

  // The industry this client serves — used by the AI to write
  // relevant cold emails and website analyses.
  // e.g. 'web design agency', 'accounting firm', 'marketing agency'
  agencyType: 'web design and digital growth agency',

  // What the client sells — the AI pitches this in generated emails.
  services: 'website design, SEO, and lead generation',

  // Target audience for lead finding defaults
  targetAudience: 'construction and trades businesses',
}
