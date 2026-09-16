'use strict';

/**
 * Well-known autonomous systems used to enrich live events (ASN -> organisation / home city)
 * and to seed the command palette.
 *
 * `tier`: 1 = global transit, 2 = regional carrier / hyperscaler, 3 = access ISP.
 *
 * @typedef {{ asn: number, name: string, city: string, cc: string, tier: 1|2|3 }} Asn
 */

/** @type {Asn[]} */
const ASNS = [
  // ---- Tier-1 / global transit -------------------------------------------
  { asn: 3356, name: 'Lumen (Level 3)', city: 'Denver', cc: 'US', tier: 1 },
  { asn: 1299, name: 'Arelion (Telia Carrier)', city: 'Stockholm', cc: 'SE', tier: 1 },
  { asn: 174, name: 'Cogent Communications', city: 'Ashburn', cc: 'US', tier: 1 },
  { asn: 2914, name: 'NTT Global IP Network', city: 'Tokyo', cc: 'JP', tier: 1 },
  { asn: 6939, name: 'Hurricane Electric', city: 'San Jose', cc: 'US', tier: 1 },
  { asn: 3257, name: 'GTT Communications', city: 'London', cc: 'GB', tier: 1 },
  { asn: 6453, name: 'TATA Communications', city: 'Mumbai', cc: 'IN', tier: 1 },
  { asn: 6461, name: 'Zayo Bandwidth', city: 'Denver', cc: 'US', tier: 1 },
  { asn: 3491, name: 'PCCW Global', city: 'Hong Kong', cc: 'HK', tier: 1 },
  { asn: 5511, name: 'Orange International Carriers', city: 'Paris', cc: 'FR', tier: 1 },
  { asn: 3320, name: 'Deutsche Telekom', city: 'Frankfurt', cc: 'DE', tier: 1 },
  { asn: 701, name: 'Verizon Business', city: 'Ashburn', cc: 'US', tier: 1 },
  { asn: 7018, name: 'AT&T Services', city: 'Dallas', cc: 'US', tier: 1 },
  { asn: 12956, name: 'Telxius', city: 'Madrid', cc: 'ES', tier: 1 },

  // ---- Hyperscalers / CDNs ------------------------------------------------
  { asn: 15169, name: 'Google LLC', city: 'San Jose', cc: 'US', tier: 2 },
  { asn: 13335, name: 'Cloudflare', city: 'San Jose', cc: 'US', tier: 2 },
  { asn: 16509, name: 'Amazon.com', city: 'Seattle', cc: 'US', tier: 2 },
  { asn: 8075, name: 'Microsoft', city: 'Seattle', cc: 'US', tier: 2 },
  { asn: 32934, name: 'Meta Platforms', city: 'San Jose', cc: 'US', tier: 2 },
  { asn: 20940, name: 'Akamai Technologies', city: 'New York', cc: 'US', tier: 2 },
  { asn: 54113, name: 'Fastly', city: 'San Jose', cc: 'US', tier: 2 },
  { asn: 16276, name: 'OVHcloud', city: 'Paris', cc: 'FR', tier: 2 },
  { asn: 24940, name: 'Hetzner Online', city: 'Frankfurt', cc: 'DE', tier: 2 },
  { asn: 14061, name: 'DigitalOcean', city: 'New York', cc: 'US', tier: 2 },

  // ---- North America access -------------------------------------------------
  { asn: 7922, name: 'Comcast Cable', city: 'New York', cc: 'US', tier: 3 },
  { asn: 20115, name: 'Charter Communications', city: 'Denver', cc: 'US', tier: 3 },
  { asn: 812, name: 'Rogers Communications', city: 'Toronto', cc: 'CA', tier: 3 },
  { asn: 577, name: 'Bell Canada', city: 'Montréal', cc: 'CA', tier: 3 },
  { asn: 8151, name: 'Uninet (Telmex)', city: 'Mexico City', cc: 'MX', tier: 3 },

  // ---- South America --------------------------------------------------------
  { asn: 28573, name: 'Claro Brasil', city: 'São Paulo', cc: 'BR', tier: 3 },
  { asn: 26599, name: 'Telefônica Brasil (Vivo)', city: 'São Paulo', cc: 'BR', tier: 3 },
  { asn: 7303, name: 'Telecom Argentina', city: 'Buenos Aires', cc: 'AR', tier: 3 },
  { asn: 3816, name: 'Colombia Telecomunicaciones', city: 'Bogotá', cc: 'CO', tier: 3 },
  { asn: 6471, name: 'Entel Chile', city: 'Santiago', cc: 'CL', tier: 3 },

  // ---- Europe ---------------------------------------------------------------
  { asn: 2856, name: 'BT', city: 'London', cc: 'GB', tier: 3 },
  { asn: 5089, name: 'Virgin Media O2', city: 'London', cc: 'GB', tier: 3 },
  { asn: 3215, name: 'Orange France', city: 'Paris', cc: 'FR', tier: 3 },
  { asn: 12322, name: 'Free SAS', city: 'Paris', cc: 'FR', tier: 3 },
  { asn: 3209, name: 'Vodafone Germany', city: 'Frankfurt', cc: 'DE', tier: 3 },
  { asn: 3352, name: 'Telefónica de España', city: 'Madrid', cc: 'ES', tier: 3 },
  { asn: 1136, name: 'KPN', city: 'Amsterdam', cc: 'NL', tier: 3 },
  { asn: 6830, name: 'Liberty Global', city: 'Amsterdam', cc: 'NL', tier: 3 },
  { asn: 3303, name: 'Swisscom', city: 'Zurich', cc: 'CH', tier: 3 },
  { asn: 5617, name: 'Orange Polska', city: 'Warsaw', cc: 'PL', tier: 3 },
  { asn: 6849, name: 'Ukrtelecom', city: 'Kyiv', cc: 'UA', tier: 3 },
  { asn: 15895, name: 'Kyivstar', city: 'Kyiv', cc: 'UA', tier: 3 },
  { asn: 12389, name: 'Rostelecom', city: 'Moscow', cc: 'RU', tier: 3 },
  { asn: 8359, name: 'MTS PJSC', city: 'Moscow', cc: 'RU', tier: 3 },
  { asn: 9121, name: 'Turk Telekom', city: 'Istanbul', cc: 'TR', tier: 3 },
  { asn: 3269, name: 'Telecom Italia', city: 'Rome', cc: 'IT', tier: 3 },

  // ---- Middle East / Africa -------------------------------------------------
  { asn: 8966, name: 'Etisalat (e&)', city: 'Dubai', cc: 'AE', tier: 3 },
  { asn: 39891, name: 'Saudi Telecom (stc)', city: 'Riyadh', cc: 'SA', tier: 3 },
  { asn: 12880, name: 'ITC Iran', city: 'Tehran', cc: 'IR', tier: 3 },
  { asn: 8697, name: 'Jordan Telecom', city: 'Tel Aviv', cc: 'IL', tier: 3 },
  { asn: 8452, name: 'Telecom Egypt (TE Data)', city: 'Cairo', cc: 'EG', tier: 3 },
  { asn: 36992, name: 'Etisalat Misr', city: 'Cairo', cc: 'EG', tier: 3 },
  { asn: 37282, name: 'MainOne', city: 'Lagos', cc: 'NG', tier: 2 },
  { asn: 29465, name: 'MTN Nigeria', city: 'Lagos', cc: 'NG', tier: 3 },
  { asn: 33771, name: 'Safaricom', city: 'Nairobi', cc: 'KE', tier: 3 },
  { asn: 37457, name: 'Telkom SA', city: 'Johannesburg', cc: 'ZA', tier: 3 },
  { asn: 36994, name: 'Vodacom', city: 'Johannesburg', cc: 'ZA', tier: 3 },
  { asn: 6713, name: 'Maroc Telecom', city: 'Casablanca', cc: 'MA', tier: 3 },

  // ---- South Asia -----------------------------------------------------------
  { asn: 9498, name: 'Bharti Airtel', city: 'Delhi', cc: 'IN', tier: 2 },
  { asn: 55836, name: 'Reliance Jio Infocomm', city: 'Mumbai', cc: 'IN', tier: 2 },
  { asn: 4755, name: 'TATA Communications (India)', city: 'Mumbai', cc: 'IN', tier: 2 },
  { asn: 9829, name: 'BSNL', city: 'Delhi', cc: 'IN', tier: 3 },
  { asn: 17557, name: 'PTCL', city: 'Karachi', cc: 'PK', tier: 3 },
  { asn: 24389, name: 'Grameenphone', city: 'Dhaka', cc: 'BD', tier: 3 },
  { asn: 18001, name: 'Dialog Axiata', city: 'Colombo', cc: 'LK', tier: 3 },

  // ---- East / Southeast Asia -----------------------------------------------
  { asn: 4134, name: 'China Telecom (CHINANET)', city: 'Beijing', cc: 'CN', tier: 2 },
  { asn: 4837, name: 'China Unicom', city: 'Beijing', cc: 'CN', tier: 2 },
  { asn: 4766, name: 'Korea Telecom', city: 'Seoul', cc: 'KR', tier: 2 },
  { asn: 4713, name: 'NTT Communications (OCN)', city: 'Tokyo', cc: 'JP', tier: 2 },
  { asn: 2516, name: 'KDDI', city: 'Tokyo', cc: 'JP', tier: 2 },
  { asn: 3462, name: 'Chunghwa Telecom (HiNet)', city: 'Taipei', cc: 'TW', tier: 2 },
  { asn: 4760, name: 'HKT Limited', city: 'Hong Kong', cc: 'HK', tier: 3 },
  { asn: 7473, name: 'Singtel', city: 'Singapore', cc: 'SG', tier: 2 },
  { asn: 4788, name: 'Telekom Malaysia', city: 'Kuala Lumpur', cc: 'MY', tier: 3 },
  { asn: 7713, name: 'Telkom Indonesia', city: 'Jakarta', cc: 'ID', tier: 3 },
  { asn: 9299, name: 'PLDT', city: 'Manila', cc: 'PH', tier: 3 },
  { asn: 45899, name: 'VNPT', city: 'Hanoi', cc: 'VN', tier: 3 },
  { asn: 7552, name: 'Viettel', city: 'Hanoi', cc: 'VN', tier: 3 },
  { asn: 23969, name: 'TOT Public Company', city: 'Bangkok', cc: 'TH', tier: 3 },

  // ---- Oceania --------------------------------------------------------------
  { asn: 1221, name: 'Telstra', city: 'Melbourne', cc: 'AU', tier: 2 },
  { asn: 7545, name: 'TPG Telecom', city: 'Sydney', cc: 'AU', tier: 3 },
  { asn: 4826, name: 'Vocus', city: 'Sydney', cc: 'AU', tier: 2 },
  { asn: 4771, name: 'Spark New Zealand', city: 'Auckland', cc: 'NZ', tier: 3 },
];

const ASN_BY_NUMBER = new Map(ASNS.map((a) => [a.asn, a]));
const TIER1 = ASNS.filter((a) => a.tier === 1);

module.exports = { ASNS, ASN_BY_NUMBER, TIER1 };
