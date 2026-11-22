const express = require('express');
const { dbAsync } = require('../database/db');
const { searchAddress, reverseGeocode } = require('../services/geocodingService');

const router = express.Router();

// 1. Get public complaints list (Masking sensitive citizen data)
router.get('/complaints', async (req, res) => {
  try {
    const { category, status, search, page = 1, limit = 12 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    let whereClauses = [];
    let params = [];

    if (category && category !== 'All') {
      whereClauses.push('c.category = ?');
      params.push(category);
    }

    if (status && status !== 'All') {
      whereClauses.push('c.status = ?');
      params.push(status);
    }

    if (search && search.trim()) {
      whereClauses.push('(c.title LIKE ? OR c.description LIKE ? OR c.address LIKE ? OR c.complaint_id LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const totalRow = await dbAsync.get(`
      SELECT COUNT(*) as total FROM Complaints c ${whereSql}
    `, params);

    const complaints = await dbAsync.all(`
      SELECT 
        c.id, c.complaint_id, c.title, c.category, c.description,
        c.image_url, c.address, c.latitude, c.longitude, c.status,
        c.priority, c.created_at, c.updated_at,
        d.department_name,
        (SELECT COUNT(*) FROM ComplaintSupports WHERE complaint_id = c.id) as support_count
      FROM Complaints c
      LEFT JOIN Departments d ON c.department_id = d.id
      ${whereSql}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit, 10), offset]);

    return res.json({
      success: true,
      total: totalRow.total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(totalRow.total / parseInt(limit, 10)),
      complaints
    });
  } catch (error) {
    console.error('Public complaints error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch public complaints.' });
  }
});

// 2. Map data - Returns geojson / array of markers with status colors
router.get('/map', async (req, res) => {
  try {
    const { category, status } = req.query;
    let whereClauses = ['latitude IS NOT NULL', 'longitude IS NOT NULL'];
    let params = [];

    if (category && category !== 'All') {
      whereClauses.push('category = ?');
      params.push(category);
    }

    if (status && status !== 'All') {
      whereClauses.push('status = ?');
      params.push(status);
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    const markers = await dbAsync.all(`
      SELECT 
        id, complaint_id, title, category, description,
        image_url, address, latitude, longitude, status, priority, created_at,
        (SELECT COUNT(*) FROM ComplaintSupports WHERE complaint_id = Complaints.id) as support_count
      FROM Complaints
      ${whereSql}
      ORDER BY created_at DESC
    `, params);

    return res.json({
      success: true,
      count: markers.length,
      markers
    });
  } catch (error) {
    console.error('Public map fetch error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load map points.' });
  }
});

// 3. Public landing statistics
router.get('/statistics', async (req, res) => {
  try {
    const totalRow = await dbAsync.get('SELECT COUNT(*) as count FROM Complaints');
    const resolvedRow = await dbAsync.get("SELECT COUNT(*) as count FROM Complaints WHERE status = 'Resolved'");
    const inProgressRow = await dbAsync.get("SELECT COUNT(*) as count FROM Complaints WHERE status = 'In Progress'");
    const pendingRow = await dbAsync.get("SELECT COUNT(*) as count FROM Complaints WHERE status = 'Pending'");
    const locationsRow = await dbAsync.get('SELECT COUNT(DISTINCT address) as count FROM Complaints');

    // Recent 4 issues for homepage showcase
    const recentIssues = await dbAsync.all(`
      SELECT id, complaint_id, title, category, address, status, image_url, created_at
      FROM Complaints
      ORDER BY created_at DESC
      LIMIT 4
    `);

    return res.json({
      success: true,
      stats: {
        totalIssues: totalRow.count || 0,
        resolvedIssues: resolvedRow.count || 0,
        inProgressIssues: inProgressRow.count || 0,
        pendingIssues: pendingRow.count || 0,
        activeLocations: locationsRow.count || 0,
        resolutionRate: totalRow.count > 0 ? Math.round((resolvedRow.count / totalRow.count) * 100) : 0
      },
      recentIssues
    });
  } catch (error) {
    console.error('Public stats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve public statistics.' });
  }
});

// 4. Geocoding endpoints (Nominatim integration)
router.get('/geocode/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query "q" is required.' });
    }
    const results = await searchAddress(query);
    return res.json({ success: true, results });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Geocoding service error.' });
  }
});

router.get('/geocode/reverse', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ success: false, message: 'lat and lon are required.' });
    }
    const result = await reverseGeocode(parseFloat(lat), parseFloat(lon));
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Reverse geocoding error.' });
  }
});

module.exports = router;
