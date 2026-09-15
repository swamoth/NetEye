'use strict';

/**
 * Major internet hubs / population centres used as incident locations.
 * `weight` biases how often a city is picked (roughly: IX + datacentre density).
 *
 * @typedef {{ name: string, country: string, cc: string, region: string, lat: number, lng: number, weight: number }} City
 */

/** @type {City[]} */
const CITIES = [
  // ---- North America -------------------------------------------------------
  { name: 'New York', country: 'United States', cc: 'US', region: 'North America', lat: 40.7128, lng: -74.006, weight: 9 },
  { name: 'Ashburn', country: 'United States', cc: 'US', region: 'North America', lat: 39.0438, lng: -77.4874, weight: 8 },
  { name: 'Chicago', country: 'United States', cc: 'US', region: 'North America', lat: 41.8781, lng: -87.6298, weight: 7 },
  { name: 'Dallas', country: 'United States', cc: 'US', region: 'North America', lat: 32.7767, lng: -96.797, weight: 6 },
  { name: 'Los Angeles', country: 'United States', cc: 'US', region: 'North America', lat: 34.0522, lng: -118.2437, weight: 8 },
  { name: 'San Jose', country: 'United States', cc: 'US', region: 'North America', lat: 37.3382, lng: -121.8863, weight: 7 },
  { name: 'Seattle', country: 'United States', cc: 'US', region: 'North America', lat: 47.6062, lng: -122.3321, weight: 6 },
  { name: 'Miami', country: 'United States', cc: 'US', region: 'North America', lat: 25.7617, lng: -80.1918, weight: 6 },
  { name: 'Atlanta', country: 'United States', cc: 'US', region: 'North America', lat: 33.749, lng: -84.388, weight: 5 },
  { name: 'Denver', country: 'United States', cc: 'US', region: 'North America', lat: 39.7392, lng: -104.9903, weight: 4 },
  { name: 'Honolulu', country: 'United States', cc: 'US', region: 'Oceania', lat: 21.3069, lng: -157.8583, weight: 2 },
  { name: 'Toronto', country: 'Canada', cc: 'CA', region: 'North America', lat: 43.6532, lng: -79.3832, weight: 6 },
  { name: 'Montréal', country: 'Canada', cc: 'CA', region: 'North America', lat: 45.5017, lng: -73.5673, weight: 4 },
  { name: 'Vancouver', country: 'Canada', cc: 'CA', region: 'North America', lat: 49.2827, lng: -123.1207, weight: 3 },
  { name: 'Mexico City', country: 'Mexico', cc: 'MX', region: 'North America', lat: 19.4326, lng: -99.1332, weight: 7 },
  { name: 'Panama City', country: 'Panama', cc: 'PA', region: 'North America', lat: 8.9824, lng: -79.5199, weight: 3 },

  // ---- South America -------------------------------------------------------
  { name: 'Bogotá', country: 'Colombia', cc: 'CO', region: 'South America', lat: 4.711, lng: -74.0721, weight: 5 },
  { name: 'Caracas', country: 'Venezuela', cc: 'VE', region: 'South America', lat: 10.4806, lng: -66.9036, weight: 3 },
  { name: 'Lima', country: 'Peru', cc: 'PE', region: 'South America', lat: -12.0464, lng: -77.0428, weight: 4 },
  { name: 'Santiago', country: 'Chile', cc: 'CL', region: 'South America', lat: -33.4489, lng: -70.6693, weight: 5 },
  { name: 'Buenos Aires', country: 'Argentina', cc: 'AR', region: 'South America', lat: -34.6037, lng: -58.3816, weight: 6 },
  { name: 'São Paulo', country: 'Brazil', cc: 'BR', region: 'South America', lat: -23.5505, lng: -46.6333, weight: 8 },
  { name: 'Rio de Janeiro', country: 'Brazil', cc: 'BR', region: 'South America', lat: -22.9068, lng: -43.1729, weight: 5 },
  { name: 'Fortaleza', country: 'Brazil', cc: 'BR', region: 'South America', lat: -3.7319, lng: -38.5267, weight: 4 },

  // ---- Europe ---------------------------------------------------------------
  { name: 'London', country: 'United Kingdom', cc: 'GB', region: 'Europe', lat: 51.5074, lng: -0.1278, weight: 9 },
  { name: 'Dublin', country: 'Ireland', cc: 'IE', region: 'Europe', lat: 53.3498, lng: -6.2603, weight: 6 },
  { name: 'Frankfurt', country: 'Germany', cc: 'DE', region: 'Europe', lat: 50.1109, lng: 8.6821, weight: 9 },
  { name: 'Amsterdam', country: 'Netherlands', cc: 'NL', region: 'Europe', lat: 52.3676, lng: 4.9041, weight: 8 },
  { name: 'Paris', country: 'France', cc: 'FR', region: 'Europe', lat: 48.8566, lng: 2.3522, weight: 8 },
  { name: 'Marseille', country: 'France', cc: 'FR', region: 'Europe', lat: 43.2965, lng: 5.3698, weight: 6 },
  { name: 'Madrid', country: 'Spain', cc: 'ES', region: 'Europe', lat: 40.4168, lng: -3.7038, weight: 6 },
  { name: 'Lisbon', country: 'Portugal', cc: 'PT', region: 'Europe', lat: 38.7223, lng: -9.1393, weight: 4 },
  { name: 'Milan', country: 'Italy', cc: 'IT', region: 'Europe', lat: 45.4642, lng: 9.19, weight: 6 },
  { name: 'Rome', country: 'Italy', cc: 'IT', region: 'Europe', lat: 41.9028, lng: 12.4964, weight: 4 },
  { name: 'Zurich', country: 'Switzerland', cc: 'CH', region: 'Europe', lat: 47.3769, lng: 8.5417, weight: 5 },
  { name: 'Vienna', country: 'Austria', cc: 'AT', region: 'Europe', lat: 48.2082, lng: 16.3738, weight: 4 },
  { name: 'Warsaw', country: 'Poland', cc: 'PL', region: 'Europe', lat: 52.2297, lng: 21.0122, weight: 5 },
  { name: 'Prague', country: 'Czechia', cc: 'CZ', region: 'Europe', lat: 50.0755, lng: 14.4378, weight: 3 },
  { name: 'Stockholm', country: 'Sweden', cc: 'SE', region: 'Europe', lat: 59.3293, lng: 18.0686, weight: 5 },
  { name: 'Oslo', country: 'Norway', cc: 'NO', region: 'Europe', lat: 59.9139, lng: 10.7522, weight: 3 },
  { name: 'Copenhagen', country: 'Denmark', cc: 'DK', region: 'Europe', lat: 55.6761, lng: 12.5683, weight: 4 },
  { name: 'Helsinki', country: 'Finland', cc: 'FI', region: 'Europe', lat: 60.1699, lng: 24.9384, weight: 3 },
  { name: 'Kyiv', country: 'Ukraine', cc: 'UA', region: 'Europe', lat: 50.4501, lng: 30.5234, weight: 5 },
  { name: 'Moscow', country: 'Russia', cc: 'RU', region: 'Europe', lat: 55.7558, lng: 37.6173, weight: 7 },
  { name: 'Saint Petersburg', country: 'Russia', cc: 'RU', region: 'Europe', lat: 59.9311, lng: 30.3609, weight: 3 },
  { name: 'Istanbul', country: 'Türkiye', cc: 'TR', region: 'Europe', lat: 41.0082, lng: 28.9784, weight: 6 },
  { name: 'Athens', country: 'Greece', cc: 'GR', region: 'Europe', lat: 37.9838, lng: 23.7275, weight: 3 },
  { name: 'Bucharest', country: 'Romania', cc: 'RO', region: 'Europe', lat: 44.4268, lng: 26.1025, weight: 3 },
  { name: 'Sofia', country: 'Bulgaria', cc: 'BG', region: 'Europe', lat: 42.6977, lng: 23.3219, weight: 2 },

  // ---- Middle East ----------------------------------------------------------
  { name: 'Dubai', country: 'United Arab Emirates', cc: 'AE', region: 'Middle East', lat: 25.2048, lng: 55.2708, weight: 6 },
  { name: 'Fujairah', country: 'United Arab Emirates', cc: 'AE', region: 'Middle East', lat: 25.1288, lng: 56.3265, weight: 3 },
  { name: 'Riyadh', country: 'Saudi Arabia', cc: 'SA', region: 'Middle East', lat: 24.7136, lng: 46.6753, weight: 4 },
  { name: 'Jeddah', country: 'Saudi Arabia', cc: 'SA', region: 'Middle East', lat: 21.4858, lng: 39.1925, weight: 3 },
  { name: 'Tel Aviv', country: 'Israel', cc: 'IL', region: 'Middle East', lat: 32.0853, lng: 34.7818, weight: 4 },
  { name: 'Tehran', country: 'Iran', cc: 'IR', region: 'Middle East', lat: 35.6892, lng: 51.389, weight: 4 },
  { name: 'Doha', country: 'Qatar', cc: 'QA', region: 'Middle East', lat: 25.2854, lng: 51.531, weight: 3 },

  // ---- Africa ---------------------------------------------------------------
  { name: 'Cairo', country: 'Egypt', cc: 'EG', region: 'Africa', lat: 30.0444, lng: 31.2357, weight: 6 },
  { name: 'Alexandria', country: 'Egypt', cc: 'EG', region: 'Africa', lat: 31.2001, lng: 29.9187, weight: 3 },
  { name: 'Casablanca', country: 'Morocco', cc: 'MA', region: 'Africa', lat: 33.5731, lng: -7.5898, weight: 3 },
  { name: 'Lagos', country: 'Nigeria', cc: 'NG', region: 'Africa', lat: 6.5244, lng: 3.3792, weight: 6 },
  { name: 'Accra', country: 'Ghana', cc: 'GH', region: 'Africa', lat: 5.6037, lng: -0.187, weight: 3 },
  { name: 'Nairobi', country: 'Kenya', cc: 'KE', region: 'Africa', lat: -1.2921, lng: 36.8219, weight: 5 },
  { name: 'Mombasa', country: 'Kenya', cc: 'KE', region: 'Africa', lat: -4.0435, lng: 39.6682, weight: 3 },
  { name: 'Djibouti', country: 'Djibouti', cc: 'DJ', region: 'Africa', lat: 11.5721, lng: 43.1456, weight: 3 },
  { name: 'Dar es Salaam', country: 'Tanzania', cc: 'TZ', region: 'Africa', lat: -6.7924, lng: 39.2083, weight: 2 },
  { name: 'Johannesburg', country: 'South Africa', cc: 'ZA', region: 'Africa', lat: -26.2041, lng: 28.0473, weight: 6 },
  { name: 'Cape Town', country: 'South Africa', cc: 'ZA', region: 'Africa', lat: -33.9249, lng: 18.4241, weight: 4 },

  // ---- South Asia -----------------------------------------------------------
  { name: 'Mumbai', country: 'India', cc: 'IN', region: 'South Asia', lat: 19.076, lng: 72.8777, weight: 9 },
  { name: 'Delhi', country: 'India', cc: 'IN', region: 'South Asia', lat: 28.6139, lng: 77.209, weight: 7 },
  { name: 'Chennai', country: 'India', cc: 'IN', region: 'South Asia', lat: 13.0827, lng: 80.2707, weight: 6 },
  { name: 'Bengaluru', country: 'India', cc: 'IN', region: 'South Asia', lat: 12.9716, lng: 77.5946, weight: 6 },
  { name: 'Hyderabad', country: 'India', cc: 'IN', region: 'South Asia', lat: 17.385, lng: 78.4867, weight: 4 },
  { name: 'Kolkata', country: 'India', cc: 'IN', region: 'South Asia', lat: 22.5726, lng: 88.3639, weight: 4 },
  { name: 'Karachi', country: 'Pakistan', cc: 'PK', region: 'South Asia', lat: 24.8607, lng: 67.0011, weight: 5 },
  { name: 'Colombo', country: 'Sri Lanka', cc: 'LK', region: 'South Asia', lat: 6.9271, lng: 79.8612, weight: 3 },
  { name: 'Dhaka', country: 'Bangladesh', cc: 'BD', region: 'South Asia', lat: 23.8103, lng: 90.4125, weight: 4 },

  // ---- East Asia ------------------------------------------------------------
  { name: 'Hong Kong', country: 'Hong Kong', cc: 'HK', region: 'East Asia', lat: 22.3193, lng: 114.1694, weight: 8 },
  { name: 'Taipei', country: 'Taiwan', cc: 'TW', region: 'East Asia', lat: 25.033, lng: 121.5654, weight: 6 },
  { name: 'Shanghai', country: 'China', cc: 'CN', region: 'East Asia', lat: 31.2304, lng: 121.4737, weight: 7 },
  { name: 'Beijing', country: 'China', cc: 'CN', region: 'East Asia', lat: 39.9042, lng: 116.4074, weight: 6 },
  { name: 'Guangzhou', country: 'China', cc: 'CN', region: 'East Asia', lat: 23.1291, lng: 113.2644, weight: 5 },
  { name: 'Seoul', country: 'South Korea', cc: 'KR', region: 'East Asia', lat: 37.5665, lng: 126.978, weight: 7 },
  { name: 'Busan', country: 'South Korea', cc: 'KR', region: 'East Asia', lat: 35.1796, lng: 129.0756, weight: 3 },
  { name: 'Tokyo', country: 'Japan', cc: 'JP', region: 'East Asia', lat: 35.6762, lng: 139.6503, weight: 9 },
  { name: 'Osaka', country: 'Japan', cc: 'JP', region: 'East Asia', lat: 34.6937, lng: 135.5023, weight: 5 },

  // ---- Southeast Asia -------------------------------------------------------
  { name: 'Singapore', country: 'Singapore', cc: 'SG', region: 'Southeast Asia', lat: 1.3521, lng: 103.8198, weight: 9 },
  { name: 'Kuala Lumpur', country: 'Malaysia', cc: 'MY', region: 'Southeast Asia', lat: 3.139, lng: 101.6869, weight: 4 },
  { name: 'Jakarta', country: 'Indonesia', cc: 'ID', region: 'Southeast Asia', lat: -6.2088, lng: 106.8456, weight: 6 },
  { name: 'Bangkok', country: 'Thailand', cc: 'TH', region: 'Southeast Asia', lat: 13.7563, lng: 100.5018, weight: 5 },
  { name: 'Ho Chi Minh City', country: 'Vietnam', cc: 'VN', region: 'Southeast Asia', lat: 10.8231, lng: 106.6297, weight: 4 },
  { name: 'Hanoi', country: 'Vietnam', cc: 'VN', region: 'Southeast Asia', lat: 21.0278, lng: 105.8342, weight: 3 },
  { name: 'Manila', country: 'Philippines', cc: 'PH', region: 'Southeast Asia', lat: 14.5995, lng: 120.9842, weight: 5 },

  // ---- Oceania --------------------------------------------------------------
  { name: 'Sydney', country: 'Australia', cc: 'AU', region: 'Oceania', lat: -33.8688, lng: 151.2093, weight: 6 },
  { name: 'Melbourne', country: 'Australia', cc: 'AU', region: 'Oceania', lat: -37.8136, lng: 144.9631, weight: 4 },
  { name: 'Perth', country: 'Australia', cc: 'AU', region: 'Oceania', lat: -31.9505, lng: 115.8605, weight: 3 },
  { name: 'Auckland', country: 'New Zealand', cc: 'NZ', region: 'Oceania', lat: -36.8485, lng: 174.7633, weight: 3 },
  { name: 'Guam', country: 'Guam', cc: 'GU', region: 'Oceania', lat: 13.4443, lng: 144.7937, weight: 2 },
];

const REGIONS = [...new Set(CITIES.map((c) => c.region))];

module.exports = { CITIES, REGIONS };
