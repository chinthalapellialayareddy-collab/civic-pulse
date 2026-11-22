const https = require('https');

// In-memory cache for recent geocoding searches
const geocodeCache = new Map();
let lastRequestTime = 0;

// Query Nominatim single request helper
function queryNominatim(q) {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(q);
    const options = {
      hostname: 'nominatim.openstreetmap.org',
      port: 443,
      path: `/search?format=json&q=${encoded}&limit=6&addressdetails=1&countrycodes=in`,
      method: 'GET',
      headers: {
        'User-Agent': 'CivicPulse-GrievancePlatform/1.0 (University-Innovation-Project-Contact: admin@civicpulse.org)'
      },
      timeout: 6000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const results = JSON.parse(data);
            resolve(results);
          } else {
            resolve([]);
          }
        } catch {
          resolve([]);
        }
      });
    });

    req.on('error', () => resolve([]));
    req.on('timeout', () => {
      req.destroy();
      resolve([]);
    });

    req.end();
  });
}

// Smart multi-tier address search with query relaxation and typo recovery
async function searchAddress(query) {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const cleanQuery = query.trim().replace(/\s+/g, ' ');
  const cacheKey = cleanQuery.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  // Rate limiting delay
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < 1000) {
    await new Promise(r => setTimeout(r, 1000 - timeSinceLast));
  }
  lastRequestTime = Date.now();

  // 1. Try raw query first
  let rawResults = await queryNominatim(cleanQuery);

  // 2. If no result found, relax tokens (e.g. remove "village", fix "telanagana" -> "telangana")
  if (!rawResults || rawResults.length === 0) {
    let corrected = cleanQuery
      .replace(/telanagana/gi, 'Telangana')
      .replace(/telagana/gi, 'Telangana')
      .replace(/hyderbad/gi, 'Hyderabad')
      .replace(/villlage/gi, '')
      .replace(/village/gi, '')
      .replace(/palli-k/gi, 'Palli')
      .trim();

    if (corrected !== cleanQuery) {
      await new Promise(r => setTimeout(r, 1000));
      lastRequestTime = Date.now();
      rawResults = await queryNominatim(corrected);
    }

    // 3. If still empty, search the primary locality/district token (e.g. "Adilabad, Telangana")
    if (!rawResults || rawResults.length === 0) {
      const parts = cleanQuery.split(/[,;\-]+/).map(p => p.trim()).filter(p => p.length > 2);
      if (parts.length > 1) {
        const fallbackTarget = `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
        await new Promise(r => setTimeout(r, 1000));
        lastRequestTime = Date.now();
        rawResults = await queryNominatim(fallbackTarget);
      }
    }
  }

  const formatted = (rawResults || []).map(item => ({
    displayName: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    type: item.type
  }));

  if (formatted.length > 0) {
    geocodeCache.set(cacheKey, formatted);
  }

  return formatted;
}

// Reverse Geocode (Lat/Lon -> Address)
async function reverseGeocode(lat, lon) {
  const cacheKey = `rev_${lat.toFixed(4)}_${lon.toFixed(4)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < 1000) {
    await new Promise(r => setTimeout(r, 1000 - timeSinceLast));
  }
  lastRequestTime = Date.now();

  return new Promise((resolve) => {
    const options = {
      hostname: 'nominatim.openstreetmap.org',
      port: 443,
      path: `/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
      method: 'GET',
      headers: {
        'User-Agent': 'CivicPulse-GrievancePlatform/1.0 (University-Innovation-Project-Contact: admin@civicpulse.org)'
      },
      timeout: 6000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const result = JSON.parse(data);
            const resObj = {
              displayName: result.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
              address: result.address || {}
            };
            geocodeCache.set(cacheKey, resObj);
            resolve(resObj);
          } else {
            resolve({ displayName: `${lat.toFixed(5)}, ${lon.toFixed(5)}` });
          }
        } catch {
          resolve({ displayName: `${lat.toFixed(5)}, ${lon.toFixed(5)}` });
        }
      });
    });

    req.on('error', () => resolve({ displayName: `${lat.toFixed(5)}, ${lon.toFixed(5)}` }));
    req.on('timeout', () => {
      req.destroy();
      resolve([]);
    });

    req.end();
  });
}

module.exports = {
  searchAddress,
  reverseGeocode
};
