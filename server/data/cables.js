'use strict';

/**
 * Submarine cable systems with approximate landing-station coordinates.
 * Coordinates are indicative (±50 km) – good enough for visualisation, not for navigation.
 *
 * @typedef {{ name: string, lat: number, lng: number }} Landing
 * @typedef {{ id: string, name: string, lengthKm: number, capacityTbps: number, rfs: number, owners: string, landings: Landing[] }} Cable
 */

/** @type {Cable[]} */
const CABLES = [
  {
    id: 'marea', name: 'MAREA', lengthKm: 6600, capacityTbps: 200, rfs: 2018, owners: 'Microsoft, Meta, Telxius',
    landings: [
      { name: 'Virginia Beach, US', lat: 36.85, lng: -75.98 },
      { name: 'Bilbao, ES', lat: 43.26, lng: -2.93 },
    ],
  },
  {
    id: 'dunant', name: 'Dunant', lengthKm: 6400, capacityTbps: 250, rfs: 2021, owners: 'Google',
    landings: [
      { name: 'Virginia Beach, US', lat: 36.85, lng: -75.98 },
      { name: 'Saint-Hilaire-de-Riez, FR', lat: 46.72, lng: -1.94 },
    ],
  },
  {
    id: 'grace-hopper', name: 'Grace Hopper', lengthKm: 7000, capacityTbps: 340, rfs: 2022, owners: 'Google',
    landings: [
      { name: 'Bellport (NY), US', lat: 40.75, lng: -72.94 },
      { name: 'Bude, GB', lat: 50.83, lng: -4.55 },
      { name: 'Bilbao, ES', lat: 43.26, lng: -2.93 },
    ],
  },
  {
    id: 'amitie', name: 'Amitié', lengthKm: 6800, capacityTbps: 400, rfs: 2023, owners: 'Meta, Microsoft, Aqua Comms, Vodafone',
    landings: [
      { name: 'Lynn (MA), US', lat: 42.46, lng: -70.95 },
      { name: 'Bude, GB', lat: 50.83, lng: -4.55 },
      { name: 'Le Porge, FR', lat: 44.87, lng: -1.2 },
    ],
  },
  {
    id: 'havfrue', name: 'Havfrue / AEC-2', lengthKm: 7200, capacityTbps: 108, rfs: 2020, owners: 'Aqua Comms, Bulk, Meta, Google',
    landings: [
      { name: 'Wall (NJ), US', lat: 40.15, lng: -74.03 },
      { name: 'Old Head of Kinsale, IE', lat: 51.6, lng: -8.53 },
      { name: 'Blaabjerg, DK', lat: 55.65, lng: 8.15 },
      { name: 'Kristiansand, NO', lat: 58.15, lng: 8.0 },
    ],
  },
  {
    id: 'tgn-atlantic', name: 'TGN-Atlantic', lengthKm: 13000, capacityTbps: 40, rfs: 2001, owners: 'Tata Communications',
    landings: [
      { name: 'Wall (NJ), US', lat: 40.15, lng: -74.03 },
      { name: 'Highbridge, GB', lat: 51.23, lng: -3.0 },
    ],
  },
  {
    id: '2africa', name: '2Africa', lengthKm: 45000, capacityTbps: 180, rfs: 2024, owners: 'Meta, MTN, Orange, Vodafone, WIOCC, China Mobile, stc, Telecom Egypt',
    landings: [
      { name: 'Marseille, FR', lat: 43.3, lng: 5.37 },
      { name: 'Port Said, EG', lat: 31.26, lng: 32.3 },
      { name: 'Djibouti, DJ', lat: 11.57, lng: 43.15 },
      { name: 'Mombasa, KE', lat: -4.04, lng: 39.67 },
      { name: 'Durban, ZA', lat: -29.86, lng: 31.03 },
      { name: 'Cape Town, ZA', lat: -33.92, lng: 18.42 },
      { name: 'Lagos, NG', lat: 6.45, lng: 3.4 },
      { name: 'Dakar, SN', lat: 14.69, lng: -17.44 },
      { name: 'Lisbon, PT', lat: 38.72, lng: -9.14 },
    ],
  },
  {
    id: 'smw5', name: 'SEA-ME-WE 5', lengthKm: 20000, capacityTbps: 24, rfs: 2016, owners: 'Consortium (19 carriers)',
    landings: [
      { name: 'Marseille, FR', lat: 43.3, lng: 5.37 },
      { name: 'Alexandria, EG', lat: 31.2, lng: 29.9 },
      { name: 'Jeddah, SA', lat: 21.5, lng: 39.2 },
      { name: 'Djibouti, DJ', lat: 11.57, lng: 43.15 },
      { name: 'Fujairah, AE', lat: 25.13, lng: 56.33 },
      { name: 'Karachi, PK', lat: 24.86, lng: 67.0 },
      { name: 'Mumbai, IN', lat: 19.0, lng: 72.8 },
      { name: 'Colombo, LK', lat: 6.9, lng: 79.9 },
      { name: 'Singapore, SG', lat: 1.35, lng: 103.8 },
    ],
  },
  {
    id: 'aae1', name: 'AAE-1', lengthKm: 25000, capacityTbps: 40, rfs: 2017, owners: 'Consortium (Asia Africa Europe-1)',
    landings: [
      { name: 'Marseille, FR', lat: 43.3, lng: 5.37 },
      { name: 'Zafarana, EG', lat: 29.1, lng: 32.65 },
      { name: 'Djibouti, DJ', lat: 11.57, lng: 43.15 },
      { name: 'Fujairah, AE', lat: 25.13, lng: 56.33 },
      { name: 'Karachi, PK', lat: 24.86, lng: 67.0 },
      { name: 'Mumbai, IN', lat: 19.0, lng: 72.8 },
      { name: 'Colombo, LK', lat: 6.9, lng: 79.9 },
      { name: 'Singapore, SG', lat: 1.35, lng: 103.8 },
      { name: 'Hong Kong, HK', lat: 22.3, lng: 114.2 },
    ],
  },
  {
    id: 'flag-fea', name: 'FLAG Europe-Asia', lengthKm: 28000, capacityTbps: 10, rfs: 1997, owners: 'Global Cloud Xchange',
    landings: [
      { name: 'Porthcurno, GB', lat: 50.04, lng: -5.66 },
      { name: 'Estepona, ES', lat: 36.43, lng: -5.15 },
      { name: 'Palermo, IT', lat: 38.12, lng: 13.36 },
      { name: 'Alexandria, EG', lat: 31.2, lng: 29.9 },
      { name: 'Suez, EG', lat: 29.97, lng: 32.55 },
      { name: 'Jeddah, SA', lat: 21.5, lng: 39.2 },
      { name: 'Dubai, AE', lat: 25.3, lng: 55.3 },
      { name: 'Mumbai, IN', lat: 19.0, lng: 72.8 },
      { name: 'Penang, MY', lat: 5.41, lng: 100.33 },
      { name: 'Hong Kong, HK', lat: 22.3, lng: 114.2 },
      { name: 'Shanghai, CN', lat: 31.2, lng: 121.5 },
      { name: 'Tokyo, JP', lat: 35.6, lng: 139.7 },
    ],
  },
  {
    id: 'imewe', name: 'IMEWE', lengthKm: 12091, capacityTbps: 3.8, rfs: 2010, owners: 'Consortium (India-Middle East-Western Europe)',
    landings: [
      { name: 'Marseille, FR', lat: 43.3, lng: 5.37 },
      { name: 'Catania, IT', lat: 37.5, lng: 15.09 },
      { name: 'Alexandria, EG', lat: 31.2, lng: 29.9 },
      { name: 'Suez, EG', lat: 29.97, lng: 32.55 },
      { name: 'Jeddah, SA', lat: 21.5, lng: 39.2 },
      { name: 'Fujairah, AE', lat: 25.13, lng: 56.33 },
      { name: 'Karachi, PK', lat: 24.86, lng: 67.0 },
      { name: 'Mumbai, IN', lat: 19.0, lng: 72.8 },
    ],
  },
  {
    id: 'eig', name: 'Europe India Gateway', lengthKm: 15000, capacityTbps: 3.84, rfs: 2011, owners: 'Consortium (EIG)',
    landings: [
      { name: 'Bude, GB', lat: 50.83, lng: -4.55 },
      { name: 'Sesimbra, PT', lat: 38.44, lng: -9.1 },
      { name: 'Gibraltar, GI', lat: 36.14, lng: -5.35 },
      { name: 'Marseille, FR', lat: 43.3, lng: 5.37 },
      { name: 'Tripoli, LY', lat: 32.9, lng: 13.18 },
      { name: 'Alexandria, EG', lat: 31.2, lng: 29.9 },
      { name: 'Jeddah, SA', lat: 21.5, lng: 39.2 },
      { name: 'Djibouti, DJ', lat: 11.57, lng: 43.15 },
      { name: 'Fujairah, AE', lat: 25.13, lng: 56.33 },
      { name: 'Mumbai, IN', lat: 19.0, lng: 72.8 },
    ],
  },
  {
    id: 'bbg', name: 'Bay of Bengal Gateway', lengthKm: 8100, capacityTbps: 9, rfs: 2016, owners: 'Vodafone, Omantel, Etisalat, Reliance Jio, Dialog, Telstra',
    landings: [
      { name: 'Barka, OM', lat: 23.71, lng: 57.89 },
      { name: 'Fujairah, AE', lat: 25.13, lng: 56.33 },
      { name: 'Mumbai, IN', lat: 19.0, lng: 72.8 },
      { name: 'Chennai, IN', lat: 13.08, lng: 80.27 },
      { name: 'Penang, MY', lat: 5.41, lng: 100.33 },
      { name: 'Singapore, SG', lat: 1.35, lng: 103.8 },
    ],
  },
  {
    id: 'smw4', name: 'SEA-ME-WE 4', lengthKm: 18800, capacityTbps: 4.6, rfs: 2005, owners: 'Consortium (16 carriers)',
    landings: [
      { name: 'Marseille, FR', lat: 43.3, lng: 5.37 },
      { name: 'Annaba, DZ', lat: 36.9, lng: 7.77 },
      { name: 'Alexandria, EG', lat: 31.2, lng: 29.9 },
      { name: 'Jeddah, SA', lat: 21.5, lng: 39.2 },
      { name: 'Fujairah, AE', lat: 25.13, lng: 56.33 },
      { name: 'Karachi, PK', lat: 24.86, lng: 67.0 },
      { name: 'Mumbai, IN', lat: 19.0, lng: 72.8 },
      { name: 'Chennai, IN', lat: 13.08, lng: 80.27 },
      { name: "Cox's Bazar, BD", lat: 21.43, lng: 91.97 },
      { name: 'Satun, TH', lat: 6.6, lng: 100.1 },
      { name: 'Tuas, SG', lat: 1.3, lng: 103.6 },
    ],
  },
  {
    id: 'sat3', name: 'SAT-3/WASC', lengthKm: 14350, capacityTbps: 0.8, rfs: 2001, owners: 'Consortium (36 carriers)',
    landings: [
      { name: 'Sesimbra, PT', lat: 38.44, lng: -9.1 },
      { name: 'Dakar, SN', lat: 14.69, lng: -17.44 },
      { name: 'Abidjan, CI', lat: 5.32, lng: -4.02 },
      { name: 'Accra, GH', lat: 5.6, lng: -0.19 },
      { name: 'Lagos, NG', lat: 6.45, lng: 3.4 },
      { name: 'Libreville, GA', lat: 0.39, lng: 9.45 },
      { name: 'Luanda, AO', lat: -8.84, lng: 13.23 },
      { name: 'Melkbosstrand, ZA', lat: -33.72, lng: 18.44 },
    ],
  },
  {
    id: 'wacs', name: 'WACS', lengthKm: 14530, capacityTbps: 14.5, rfs: 2012, owners: 'Consortium (West Africa Cable System)',
    landings: [
      { name: 'Yzerfontein, ZA', lat: -33.35, lng: 18.16 },
      { name: 'Luanda, AO', lat: -8.84, lng: 13.23 },
      { name: 'Lagos, NG', lat: 6.45, lng: 3.4 },
      { name: 'Accra, GH', lat: 5.6, lng: -0.19 },
      { name: 'Abidjan, CI', lat: 5.32, lng: -4.02 },
      { name: 'Dakar, SN', lat: 14.69, lng: -17.44 },
      { name: 'Seixal, PT', lat: 38.64, lng: -9.1 },
      { name: 'Highbridge, GB', lat: 51.23, lng: -3.0 },
    ],
  },
  {
    id: 'equiano', name: 'Equiano', lengthKm: 15000, capacityTbps: 144, rfs: 2023, owners: 'Google',
    landings: [
      { name: 'Sesimbra, PT', lat: 38.44, lng: -9.1 },
      { name: 'Lomé, TG', lat: 6.13, lng: 1.22 },
      { name: 'Lagos, NG', lat: 6.45, lng: 3.4 },
      { name: 'Swakopmund, NA', lat: -22.68, lng: 14.53 },
      { name: 'Melkbosstrand, ZA', lat: -33.72, lng: 18.44 },
    ],
  },
  {
    id: 'eassy', name: 'EASSy', lengthKm: 10000, capacityTbps: 10, rfs: 2010, owners: 'Consortium (Eastern Africa Submarine System)',
    landings: [
      { name: 'Port Sudan, SD', lat: 19.62, lng: 37.22 },
      { name: 'Djibouti, DJ', lat: 11.57, lng: 43.15 },
      { name: 'Mombasa, KE', lat: -4.04, lng: 39.67 },
      { name: 'Dar es Salaam, TZ', lat: -6.8, lng: 39.28 },
      { name: 'Maputo, MZ', lat: -25.97, lng: 32.57 },
      { name: 'Mtunzini, ZA', lat: -28.95, lng: 31.75 },
    ],
  },
  {
    id: 'seacom', name: 'SEACOM', lengthKm: 17000, capacityTbps: 12, rfs: 2009, owners: 'SEACOM',
    landings: [
      { name: 'Mtunzini, ZA', lat: -28.95, lng: 31.75 },
      { name: 'Maputo, MZ', lat: -25.97, lng: 32.57 },
      { name: 'Dar es Salaam, TZ', lat: -6.8, lng: 39.28 },
      { name: 'Mombasa, KE', lat: -4.04, lng: 39.67 },
      { name: 'Djibouti, DJ', lat: 11.57, lng: 43.15 },
      { name: 'Mumbai, IN', lat: 19.0, lng: 72.8 },
    ],
  },
  {
    id: 'aag', name: 'Asia-America Gateway', lengthKm: 20000, capacityTbps: 2.88, rfs: 2009, owners: 'Consortium (AAG)',
    landings: [
      { name: 'Singapore, SG', lat: 1.35, lng: 103.8 },
      { name: 'Vũng Tàu, VN', lat: 10.35, lng: 107.08 },
      { name: 'Hong Kong, HK', lat: 22.3, lng: 114.2 },
      { name: 'Currimao, PH', lat: 17.99, lng: 120.49 },
      { name: 'Guam, GU', lat: 13.44, lng: 144.79 },
      { name: 'Keawaula (HI), US', lat: 21.43, lng: -158.19 },
      { name: 'San Luis Obispo (CA), US', lat: 35.28, lng: -120.66 },
    ],
  },
  {
    id: 'apg', name: 'Asia Pacific Gateway', lengthKm: 10400, capacityTbps: 54.8, rfs: 2016, owners: 'Consortium (APG)',
    landings: [
      { name: 'Singapore, SG', lat: 1.35, lng: 103.8 },
      { name: 'Kuantan, MY', lat: 3.8, lng: 103.33 },
      { name: 'Vũng Tàu, VN', lat: 10.35, lng: 107.08 },
      { name: 'Hong Kong, HK', lat: 22.3, lng: 114.2 },
      { name: 'Shantou, CN', lat: 23.35, lng: 116.68 },
      { name: 'Toucheng, TW', lat: 24.86, lng: 121.82 },
      { name: 'Busan, KR', lat: 35.1, lng: 129.0 },
      { name: 'Chikura, JP', lat: 34.95, lng: 139.95 },
    ],
  },
  {
    id: 'sjc', name: 'Southeast Asia-Japan Cable', lengthKm: 8900, capacityTbps: 28, rfs: 2013, owners: 'Consortium (SJC)',
    landings: [
      { name: 'Tuas, SG', lat: 1.3, lng: 103.6 },
      { name: 'Songkhla, TH', lat: 7.2, lng: 100.6 },
      { name: 'Hong Kong, HK', lat: 22.3, lng: 114.2 },
      { name: 'Shantou, CN', lat: 23.35, lng: 116.68 },
      { name: 'Toucheng, TW', lat: 24.86, lng: 121.82 },
      { name: 'Chikura, JP', lat: 34.95, lng: 139.95 },
    ],
  },
  {
    id: 'tpe', name: 'Trans-Pacific Express', lengthKm: 17700, capacityTbps: 5.12, rfs: 2008, owners: 'Consortium (TPE)',
    landings: [
      { name: 'Nedonna Beach (OR), US', lat: 45.68, lng: -123.94 },
      { name: 'Chikura, JP', lat: 34.95, lng: 139.95 },
      { name: 'Keoje, KR', lat: 34.88, lng: 128.62 },
      { name: 'Qingdao, CN', lat: 36.07, lng: 120.38 },
      { name: 'Chongming, CN', lat: 31.6, lng: 121.4 },
      { name: 'Tanshui, TW', lat: 25.17, lng: 121.44 },
    ],
  },
  {
    id: 'faster', name: 'FASTER', lengthKm: 11600, capacityTbps: 60, rfs: 2016, owners: 'Google, KDDI, SingTel, China Mobile, China Telecom, Global Transit',
    landings: [
      { name: 'Bandon (OR), US', lat: 43.12, lng: -124.41 },
      { name: 'Chikura, JP', lat: 34.95, lng: 139.95 },
      { name: 'Shima, JP', lat: 34.3, lng: 136.8 },
    ],
  },
  {
    id: 'plcn', name: 'Pacific Light Cable Network', lengthKm: 12800, capacityTbps: 144, rfs: 2022, owners: 'Google, Meta',
    landings: [
      { name: 'El Segundo (CA), US', lat: 33.92, lng: -118.42 },
      { name: 'Toucheng, TW', lat: 24.86, lng: 121.82 },
      { name: 'Baler, PH', lat: 15.76, lng: 121.56 },
    ],
  },
  {
    id: 'jupiter', name: 'JUPITER', lengthKm: 14000, capacityTbps: 60, rfs: 2020, owners: 'Amazon, Meta, NTT, PCCW, PLDT, SoftBank',
    landings: [
      { name: 'Hermosa Beach (CA), US', lat: 33.86, lng: -118.4 },
      { name: 'Maruyama, JP', lat: 35.1, lng: 139.9 },
      { name: 'Shima, JP', lat: 34.3, lng: 136.8 },
      { name: 'Daet, PH', lat: 14.11, lng: 122.95 },
    ],
  },
  {
    id: 'bifrost', name: 'Bifrost', lengthKm: 15000, capacityTbps: 190, rfs: 2024, owners: 'Meta, Keppel, Telin',
    landings: [
      { name: 'Grover Beach (CA), US', lat: 35.12, lng: -120.62 },
      { name: 'Guam, GU', lat: 13.44, lng: 144.79 },
      { name: 'Davao, PH', lat: 7.07, lng: 125.6 },
      { name: 'Anyer, ID', lat: -6.05, lng: 105.9 },
      { name: 'Singapore, SG', lat: 1.35, lng: 103.8 },
    ],
  },
  {
    id: 'southern-cross', name: 'Southern Cross NEXT', lengthKm: 15840, capacityTbps: 72, rfs: 2022, owners: 'Southern Cross Cables',
    landings: [
      { name: 'Sydney, AU', lat: -33.9, lng: 151.2 },
      { name: 'Takapuna, NZ', lat: -36.79, lng: 174.77 },
      { name: 'Suva, FJ', lat: -18.14, lng: 178.44 },
      { name: 'Hermosa Beach (CA), US', lat: 33.86, lng: -118.4 },
    ],
  },
  {
    id: 'hawaiki', name: 'Hawaiki', lengthKm: 15000, capacityTbps: 67, rfs: 2018, owners: 'BW Digital',
    landings: [
      { name: 'Sydney, AU', lat: -33.9, lng: 151.2 },
      { name: 'Mangawhai, NZ', lat: -36.1, lng: 174.6 },
      { name: 'Kapolei (HI), US', lat: 21.33, lng: -158.08 },
      { name: 'Pacific City (OR), US', lat: 45.2, lng: -123.96 },
    ],
  },
  {
    id: 'indigo-west', name: 'INDIGO-West', lengthKm: 4600, capacityTbps: 36, rfs: 2019, owners: 'Google, Indosat, Singtel, SubPartners, Telstra, AARNet',
    landings: [
      { name: 'Perth, AU', lat: -31.95, lng: 115.86 },
      { name: 'Jakarta, ID', lat: -6.1, lng: 106.8 },
      { name: 'Singapore, SG', lat: 1.35, lng: 103.8 },
    ],
  },
  {
    id: 'jga', name: 'Japan-Guam-Australia', lengthKm: 9500, capacityTbps: 36, rfs: 2020, owners: 'Google, RTI, AARNet',
    landings: [
      { name: 'Sydney, AU', lat: -33.9, lng: 151.2 },
      { name: 'Guam, GU', lat: 13.44, lng: 144.79 },
      { name: 'Maruyama, JP', lat: 35.1, lng: 139.9 },
    ],
  },
  {
    id: 'curie', name: 'Curie', lengthKm: 10500, capacityTbps: 72, rfs: 2020, owners: 'Google',
    landings: [
      { name: 'El Segundo (CA), US', lat: 33.92, lng: -118.42 },
      { name: 'Balboa, PA', lat: 8.95, lng: -79.57 },
      { name: 'Valparaíso, CL', lat: -33.05, lng: -71.62 },
    ],
  },
  {
    id: 'monet', name: 'Monet', lengthKm: 10556, capacityTbps: 64, rfs: 2017, owners: 'Google, Algar, Angola Cables, Antel',
    landings: [
      { name: 'Boca Raton (FL), US', lat: 26.36, lng: -80.08 },
      { name: 'Fortaleza, BR', lat: -3.73, lng: -38.53 },
      { name: 'Santos, BR', lat: -23.96, lng: -46.33 },
    ],
  },
  {
    id: 'brusa', name: 'BRUSA', lengthKm: 11000, capacityTbps: 138, rfs: 2018, owners: 'Telxius',
    landings: [
      { name: 'Virginia Beach, US', lat: 36.85, lng: -75.98 },
      { name: 'San Juan, PR', lat: 18.47, lng: -66.1 },
      { name: 'Fortaleza, BR', lat: -3.73, lng: -38.53 },
      { name: 'Rio de Janeiro, BR', lat: -22.9, lng: -43.2 },
    ],
  },
  {
    id: 'seabras', name: 'Seabras-1', lengthKm: 10800, capacityTbps: 72, rfs: 2017, owners: 'Seaborn Networks',
    landings: [
      { name: 'Wall (NJ), US', lat: 40.15, lng: -74.03 },
      { name: 'Praia Grande, BR', lat: -24.0, lng: -46.4 },
    ],
  },
  {
    id: 'ellalink', name: 'EllaLink', lengthKm: 6000, capacityTbps: 100, rfs: 2021, owners: 'EllaLink',
    landings: [
      { name: 'Sines, PT', lat: 37.95, lng: -8.87 },
      { name: 'Fortaleza, BR', lat: -3.73, lng: -38.53 },
    ],
  },
];

module.exports = { CABLES };
