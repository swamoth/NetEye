'use strict';

/**
 * RIPE RIS route collectors (RRCs). Locations are the exchange points / facilities the
 * collectors peer at, as published by RIPE NCC. Used to draw where a BGP update was observed.
 *
 * @type {Record<string, { name: string, city: string, cc: string, lat: number, lng: number }>}
 */
const RRC = {
  rrc00: { name: 'RIPE NCC (multihop)', city: 'Amsterdam', cc: 'NL', lat: 52.37, lng: 4.9 },
  rrc01: { name: 'LINX', city: 'London', cc: 'GB', lat: 51.51, lng: -0.13 },
  rrc03: { name: 'AMS-IX / NL-IX', city: 'Amsterdam', cc: 'NL', lat: 52.35, lng: 4.95 },
  rrc04: { name: 'CIXP', city: 'Geneva', cc: 'CH', lat: 46.2, lng: 6.14 },
  rrc05: { name: 'VIX', city: 'Vienna', cc: 'AT', lat: 48.21, lng: 16.37 },
  rrc06: { name: 'JPIX / DIX-IE', city: 'Tokyo', cc: 'JP', lat: 35.69, lng: 139.76 },
  rrc07: { name: 'Netnod', city: 'Stockholm', cc: 'SE', lat: 59.33, lng: 18.07 },
  rrc10: { name: 'MIX', city: 'Milan', cc: 'IT', lat: 45.46, lng: 9.19 },
  rrc11: { name: 'NYIIX', city: 'New York', cc: 'US', lat: 40.71, lng: -74.01 },
  rrc12: { name: 'DE-CIX', city: 'Frankfurt', cc: 'DE', lat: 50.11, lng: 8.68 },
  rrc13: { name: 'MSK-IX', city: 'Moscow', cc: 'RU', lat: 55.76, lng: 37.62 },
  rrc14: { name: 'PAIX', city: 'Palo Alto', cc: 'US', lat: 37.44, lng: -122.14 },
  rrc15: { name: 'IX.br', city: 'São Paulo', cc: 'BR', lat: -23.55, lng: -46.63 },
  rrc16: { name: 'NOTA', city: 'Miami', cc: 'US', lat: 25.76, lng: -80.19 },
  rrc18: { name: 'CATNIX', city: 'Barcelona', cc: 'ES', lat: 41.39, lng: 2.17 },
  rrc19: { name: 'NAPAfrica', city: 'Johannesburg', cc: 'ZA', lat: -26.2, lng: 28.05 },
  rrc20: { name: 'SwissIX', city: 'Zurich', cc: 'CH', lat: 47.38, lng: 8.54 },
  rrc21: { name: 'France-IX', city: 'Paris', cc: 'FR', lat: 48.86, lng: 2.35 },
  rrc22: { name: 'InterLAN', city: 'Bucharest', cc: 'RO', lat: 44.43, lng: 26.1 },
  rrc23: { name: 'Equinix SG', city: 'Singapore', cc: 'SG', lat: 1.35, lng: 103.82 },
  rrc24: { name: 'LACNIC (multihop)', city: 'Montevideo', cc: 'UY', lat: -34.9, lng: -56.16 },
  rrc25: { name: 'RIPE NCC (multihop)', city: 'Amsterdam', cc: 'NL', lat: 52.38, lng: 4.88 },
  rrc26: { name: 'UAE-IX', city: 'Dubai', cc: 'AE', lat: 25.2, lng: 55.27 },
};

/** "rrc03.ripe.net" -> RRC entry (or undefined). */
function collectorFor(host) {
  const m = /^(rrc\d\d)/i.exec(String(host || ''));
  return m ? RRC[m[1].toLowerCase()] : undefined;
}

module.exports = { RRC, collectorFor };
