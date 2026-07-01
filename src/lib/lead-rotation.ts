// Rotation lists for daily lead finding.
// The cron walks through industry × location combos so each run targets
// fresh businesses. Dedup in the find logic prevents repeats in the CRM.

export const INDUSTRIES = [
  'builders',
  'construction companies',
  'home builders',
  'commercial builders',
  'renovation builders',
  'concreters',
  'concrete contractors',
  'electricians',
  'plumbers',
  'carpenters',
  'roofers',
  'roofing contractors',
  'painters',
  'painting contractors',
  'landscapers',
  'landscaping companies',
  'tilers',
  'tiling contractors',
  'bricklayers',
  'plasterers',
  'fencing contractors',
  'excavation contractors',
  'demolition contractors',
  'scaffolding companies',
  'waterproofing contractors',
  'flooring contractors',
  'kitchen renovation',
  'bathroom renovation',
  'HVAC contractors',
  'air conditioning installers',
  'solar installers',
  'glaziers',
  'cabinet makers',
  'joinery',
  'paving contractors',
  'retaining wall builders',
  'decking builders',
  'pergola builders',
  'shed builders',
  'pool builders',
]

export const LOCATIONS = [
  // Sydney & NSW
  'Sydney NSW', 'Parramatta NSW', 'Penrith NSW', 'Liverpool NSW', 'Blacktown NSW',
  'Bondi NSW', 'Manly NSW', 'Chatswood NSW', 'Cronulla NSW', 'Campbelltown NSW',
  'Newcastle NSW', 'Wollongong NSW', 'Central Coast NSW', 'Coffs Harbour NSW', 'Wagga Wagga NSW',
  // Melbourne & VIC
  'Melbourne VIC', 'Geelong VIC', 'Ballarat VIC', 'Bendigo VIC', 'Frankston VIC',
  'Dandenong VIC', 'Ringwood VIC', 'Werribee VIC', 'Shepparton VIC',
  // Brisbane & QLD
  'Brisbane QLD', 'Gold Coast QLD', 'Sunshine Coast QLD', 'Cairns QLD', 'Townsville QLD',
  'Toowoomba QLD', 'Ipswich QLD', 'Mackay QLD', 'Rockhampton QLD',
  // Perth & WA
  'Perth WA', 'Fremantle WA', 'Joondalup WA', 'Rockingham WA', 'Mandurah WA',
  // Adelaide & SA
  'Adelaide SA', 'Glenelg SA', 'Mount Barker SA',
  // Other
  'Canberra ACT', 'Hobart TAS', 'Launceston TAS', 'Darwin NT',
]

// Given a day index, pick a rotating industry + location pair.
export function getRotationForDay(dayIndex: number): { industry: string; location: string } {
  const industry = INDUSTRIES[dayIndex % INDUSTRIES.length]
  // Advance location on a different cycle so combos vary widely
  const locIndex = Math.floor(dayIndex / INDUSTRIES.length) % LOCATIONS.length
  const location = LOCATIONS[locIndex]
  return { industry, location }
}
