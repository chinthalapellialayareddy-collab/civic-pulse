// Calculates distance between two coordinates in meters using the Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}

// Token-based Jaccard similarity between two strings
function calculateTextSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const set1 = new Set(str1.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));
  const set2 = new Set(str2.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));

  if (set1.size === 0 || set2.size === 0) return 0;

  let intersection = 0;
  for (const item of set1) {
    if (set2.has(item)) {
      intersection++;
    }
  }

  const union = new Set([...set1, ...set2]).size;
  return intersection / union;
}

// Detect duplicate complaints from existing candidate list
function findPotentialDuplicates(newComplaint, existingComplaints, thresholdMeters = 500) {
  const matches = [];

  for (const existing of existingComplaints) {
    // Only check unresolved complaints or complaints within the last 14 days
    if (existing.status === 'Resolved') continue;

    const distance = calculateDistance(
      newComplaint.latitude,
      newComplaint.longitude,
      existing.latitude,
      existing.longitude
    );

    const isSameCategory = existing.category === newComplaint.category;
    const titleSim = calculateTextSimilarity(newComplaint.title, existing.title);
    const descSim = calculateTextSimilarity(newComplaint.description, existing.description);
    const textScore = (titleSim * 0.6) + (descSim * 0.4);

    let matchProbability = 0;

    // Proximity score (0 to 1)
    if (distance <= thresholdMeters) {
      const distanceFactor = 1 - (distance / thresholdMeters);
      matchProbability += distanceFactor * 0.45;
    }

    if (isSameCategory) {
      matchProbability += 0.35;
    }

    matchProbability += textScore * 0.20;

    // If strong location + category match OR very high text match
    if ((distance <= thresholdMeters && isSameCategory) || matchProbability >= 0.65) {
      matches.push({
        complaint: existing,
        distanceMeters: Math.round(distance),
        similarityScore: Math.round(matchProbability * 100),
        reason: distance <= thresholdMeters && isSameCategory 
          ? `Similar category reported within ${Math.round(distance)}m`
          : `High textual and geographic similarity (${Math.round(matchProbability * 100)}%)`
      });
    }
  }

  // Sort by highest similarity
  return matches.sort((a, b) => b.similarityScore - a.similarityScore);
}

module.exports = {
  calculateDistance,
  calculateTextSimilarity,
  findPotentialDuplicates
};
