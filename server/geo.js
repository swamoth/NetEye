'use strict';

/**
 * Server-side geo helpers shared by the aggregator and the source adapters.
 * (The browser has its own copy of the math in app/utils/coordinates.ts.)
 */

const { CITIES } = require('./data/cities');
const { ASNS } = require('./data/asns');
const { COUNTRIES, regionOf } = require('./data/countries');

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

function haversineKm(a, b) {
  const R = 6371;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point at fraction `f` along the great circle from a to b. */
function interpolate(a, b, f) {
  const p1 = rad(a.lat), l1 = rad(a.lng), p2 = rad(b.lat), l2 = rad(b.lng);
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2));
  if (d < 1e-9) return { lat: a.lat, lng: a.lng };
  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
  const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
  const z = A * Math.sin(p1) + B * Math.sin(p2);
  return { lat: deg(Math.atan2(z, Math.sqrt(x * x + y * y))), lng: deg(Math.atan2(y, x)) };
}

const CITY_BY_NAME = new Map(CITIES.map((c) => [c.name, c]));
const ASN_BY_NUMBER = new Map(ASNS.map((a) => [a.asn, a]));

/** Location record for a city row. */
function locationOf(c) {
  return { lat: c.lat, lng: c.lng, city: c.name, country: c.country, countryCode: c.cc, region: c.region };
}

/** Best place to represent a country: its heaviest hub city, else the centroid. */
function placeForCountry(cc) {
  if (!cc) return null;
  const code = String(cc).toUpperCase();
  const cities = CITIES.filter((c) => c.cc === code).sort((a, b) => b.weight - a.weight);
  if (cities.length) return locationOf(cities[0]);
  const k = COUNTRIES[code];
  if (k) return { lat: k.lat, lng: k.lng, city: undefined, country: k.name, countryCode: code, region: regionOf(code) };
  return null;
}

/** Home city of a known ASN, else null. */
function placeForAsn(asn) {
  const a = ASN_BY_NUMBER.get(Number(asn));
  if (!a) return null;
  const c = CITY_BY_NAME.get(a.city);
  return c ? locationOf(c) : placeForCountry(a.cc);
}

/**
 * Geolocate a live event: prefer a known ASN's home city (when it matches the
 * country, if one is given), then fall back to the country.
 */
function geolocate(cc, asns = []) {
  for (const asn of asns) {
    const p = placeForAsn(asn);
    if (p && (!cc || p.countryCode === String(cc).toUpperCase())) return p;
  }
  return placeForCountry(cc);
}

function countryName(cc) {
  const k = COUNTRIES[String(cc || '').toUpperCase()];
  return k ? k.name : cc || 'Unknown';
}

module.exports = { haversineKm, interpolate, locationOf, placeForCountry, placeForAsn, geolocate, countryName, CITY_BY_NAME, ASN_BY_NUMBER };
