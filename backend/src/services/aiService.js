const config = require('../config/env');
const { dbAsync } = require('../database/db');

// Supported Categories & Priorities
const CIVIC_CATEGORIES = [
  'Road Damage',
  'Garbage Overflow',
  'Water Leakage',
  'Streetlight Failure',
  'Drainage Problems',
  'Public Infrastructure',
  'Other'
];

const CIVIC_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

// ── 1. PRIMARY AI: Google Gemini API ─────────────────────────────
async function callGemini(promptText, systemInstruction = '') {
  const apiKey = config.geminiApiKey;
  if (!apiKey || !apiKey.trim()) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
  
  const payload = {
    contents: [
      {
        parts: [{ text: promptText }]
      }
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 900
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`Gemini API responded with status ${res.status}`);
      return null;
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return candidateText ? candidateText.trim() : null;
  } catch (err) {
    clearTimeout(timer);
    console.warn('Gemini API call failed:', err.message);
    return null;
  }
}

// ── 2. BACKUP AI: Groq API (Llama 3.3 / Llama 3.1) ───────────────
async function callGroq(messages, systemInstruction = '') {
  const apiKey = config.groqApiKey;
  if (!apiKey || !apiKey.trim()) return null;

  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const fullMessages = [];
  if (systemInstruction) {
    fullMessages.push({ role: 'system', content: systemInstruction });
  }
  if (Array.isArray(messages)) {
    fullMessages.push(...messages);
  } else if (typeof messages === 'string') {
    fullMessages.push({ role: 'user', content: messages });
  }

  const payload = {
    model: 'llama-3.3-70b-versatile',
    messages: fullMessages,
    temperature: 0.35,
    max_tokens: 900
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`Groq API responded with status ${res.status}`);
      return null;
    }

    const data = await res.json();
    const choiceText = data.choices?.[0]?.message?.content;
    return choiceText ? choiceText.trim() : null;
  } catch (err) {
    clearTimeout(timer);
    console.warn('Groq API call failed:', err.message);
    return null;
  }
}

// ── 3. UNIFIED AI CALLER (Gemini -> Groq -> null) ────────────────
async function callAiUnified({ prompt, systemInstruction = '' }) {
  // Try 1: Gemini
  if (config.geminiApiKey) {
    const geminiRes = await callGemini(prompt, systemInstruction);
    if (geminiRes) {
      return { text: geminiRes, provider: 'Google Gemini AI' };
    }
  }

  // Try 2: Groq
  if (config.groqApiKey) {
    const groqRes = await callGroq(prompt, systemInstruction);
    if (groqRes) {
      return { text: groqRes, provider: 'Groq (Llama 3.3)' };
    }
  }

  return null;
}

// ── 4. RULE-BASED CLASSIFIER (Fallback) ─────────────────────────
function ruleBasedClassify(text) {
  const lower = (text || '').toLowerCase();

  if (lower.includes('pothole') || lower.includes('road') || lower.includes('asphalt') || lower.includes('crater') || lower.includes('divider') || lower.includes('రోడ్డు') || lower.includes('గుంత')) {
    return {
      category: 'Road Damage',
      priority: lower.includes('accident') || lower.includes('deep') || lower.includes('broken') || lower.includes('ప్రమాదం') ? 'High' : 'Medium',
      confidence: 0.88,
      reason: 'Keywords related to road surface, potholes, and vehicular transit detected.'
    };
  }
  if (lower.includes('garbage') || lower.includes('trash') || lower.includes('waste') || lower.includes('dump') || lower.includes('smell') || lower.includes('litter') || lower.includes('చెత్త') || lower.includes('కంపు')) {
    return {
      category: 'Garbage Overflow',
      priority: lower.includes('rotting') || lower.includes('hospital') || lower.includes('health') || lower.includes('కుళ్ళి') ? 'High' : 'Medium',
      confidence: 0.92,
      reason: 'Keywords related to municipal sanitation and waste accumulation detected.'
    };
  }
  if (lower.includes('water') || lower.includes('pipe') || lower.includes('leak') || lower.includes('pipeline') || lower.includes('burst') || lower.includes('నీరు') || lower.includes('పైపు') || lower.includes('లీకేజ్')) {
    return {
      category: 'Water Leakage',
      priority: lower.includes('burst') || lower.includes('flooding') || lower.includes('wasting') || lower.includes('ముంపు') ? 'High' : 'Medium',
      confidence: 0.90,
      reason: 'Keywords related to municipal potable water supply and pipe damage detected.'
    };
  }
  if (lower.includes('light') || lower.includes('lamp') || lower.includes('dark') || lower.includes('pole') || lower.includes('electricity') || lower.includes('wire') || lower.includes('స్ట్రీట్ లైట్') || lower.includes('చీకటి') || lower.includes('దీపం')) {
    return {
      category: 'Streetlight Failure',
      priority: lower.includes('dark') || lower.includes('crime') || lower.includes('accident') || lower.includes('మహిళ') ? 'High' : 'Medium',
      confidence: 0.89,
      reason: 'Keywords related to municipal street lighting infrastructure detected.'
    };
  }
  if (lower.includes('drain') || lower.includes('sewage') || lower.includes('manhole') || lower.includes('clogged') || lower.includes('gutter') || lower.includes('కాలువ') || lower.includes('మురుగు') || lower.includes('మ్యాన్‌హోల్')) {
    return {
      category: 'Drainage Problems',
      priority: lower.includes('open manhole') || lower.includes('overflow') || lower.includes('flooded') || lower.includes('తెరిచి') ? 'Critical' : 'High',
      confidence: 0.91,
      reason: 'Keywords related to stormwater drains, underground sewage, or open manholes detected.'
    };
  }
  if (lower.includes('park') || lower.includes('bench') || lower.includes('bus stand') || lower.includes('footpath') || lower.includes('sidewalk') || lower.includes('bridge') || lower.includes('పార్కు') || lower.includes('ఫుట్‌పాత్')) {
    return {
      category: 'Public Infrastructure',
      priority: 'Medium',
      confidence: 0.85,
      reason: 'Keywords related to municipal civic amenities and public spaces detected.'
    };
  }

  return {
    category: 'Other',
    priority: 'Medium',
    confidence: 0.70,
    reason: 'General civic concern requiring municipal inspection.'
  };
}

function ruleBasedSummarize(text) {
  if (!text) return '';
  const sentences = text.trim().split(/(?<=[.?!])\s+/);
  if (sentences.length <= 2) return text.trim();
  return sentences.slice(0, 2).join(' ');
}

// ── 5. COMPLAINT ANALYSIS (Category, Priority, Summary) ───────────
async function analyzeComplaint(title, description) {
  const combinedText = `${title || ''} ${description || ''}`.trim();
  const fallbackClassification = ruleBasedClassify(combinedText);
  const fallbackSummary = ruleBasedSummarize(description || title);

  const prompt = `You are an AI assistant for the CivicPulse municipal grievance portal.
Analyze this civic issue report:
Title: "${title || ''}"
Description: "${description || ''}"

Valid categories:
1. Road Damage
2. Garbage Overflow
3. Water Leakage
4. Streetlight Failure
5. Drainage Problems
6. Public Infrastructure
7. Other

Valid priorities:
- Low (cosmetic, minor)
- Medium (standard issue, inconvenience)
- High (safety hazard, traffic obstruction, public health)
- Critical (life threatening, severe flooding, open manholes)

Return ONLY a valid JSON object without markdown fences, with these exact keys:
{
  "category": "one of the valid categories",
  "priority": "one of the valid priorities",
  "confidence": 0.95,
  "reason": "short explanation",
  "summary": "1-2 sentence executive summary of the issue"
}`;

  const aiResult = await callAiUnified({ prompt });
  if (aiResult) {
    try {
      const cleaned = aiResult.text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        isAiPowered: true,
        source: aiResult.provider,
        category: CIVIC_CATEGORIES.includes(parsed.category) ? parsed.category : fallbackClassification.category,
        priority: CIVIC_PRIORITIES.includes(parsed.priority) ? parsed.priority : fallbackClassification.priority,
        confidence: parsed.confidence || 0.95,
        reason: parsed.reason || 'AI contextual reasoning',
        summary: parsed.summary || fallbackSummary
      };
    } catch (e) {
      console.warn('Failed to parse AI output as JSON:', e.message);
    }
  }

  return {
    isAiPowered: false,
    source: 'Rule-Based Engine (Fallback)',
    category: fallbackClassification.category,
    priority: fallbackClassification.priority,
    confidence: fallbackClassification.confidence,
    reason: fallbackClassification.reason,
    summary: fallbackSummary
  };
}

// ── 6. DESCRIPTION IMPROVEMENT (Polishing citizen descriptions) ──
async function improveDescription({ description, category = '', title = '', language = 'en' }) {
  if (!description || !description.trim()) {
    return {
      improvedText: '',
      source: 'None',
      points: []
    };
  }

  const isTelugu = language === 'te' || /[\u0C00-\u0C7F]/.test(description);

  const systemInstruction = `You are a municipal civic drafting expert for CivicPulse.
Help citizens rewrite poorly phrased, incomplete, or informal civic complaints into clear, actionable, professional grievance reports that municipal field engineers can act on immediately.

Rules:
1. Preserve all factual details (locations, duration, vehicle damages).
2. Clarify the specific civic problem and the exact public hazard.
3. Suggest an actionable request for municipal authorities.
4. Keep it concise (2 to 4 sentences).
5. If the requested language is Telugu or user wrote in Telugu, return the improved description in fluent, respectful Telugu script. Otherwise return in clean English.
6. Return ONLY the improved description paragraph, no introductory text, no quotes.`;

  const prompt = `Please improve this citizen's complaint description:
Category: ${category || 'Civic Grievance'}
Title: ${title || 'N/A'}
Raw Description: "${description.trim()}"
Target Language: ${isTelugu ? 'Telugu (తెలుగు)' : 'English'}`;

  const aiResult = await callAiUnified({ prompt, systemInstruction });
  if (aiResult && aiResult.text) {
    return {
      improvedText: aiResult.text.replace(/^["']|["']$/g, '').trim(),
      source: aiResult.provider,
      language: isTelugu ? 'te' : 'en'
    };
  }

  // Rule-based fallback description enhancement
  let enhanced = description.trim();
  const classified = ruleBasedClassify(`${title} ${description}`);
  const cat = category || classified.category;

  if (isTelugu) {
    enhanced = `${cat} సమస్యపై మున్సిపల్ అధికారులకు ఫిర్యాదు: ${enhanced}. ఈ సమస్య వల్ల స్థానిక పౌరులు మరియు ప్రయాణికులకు తీవ్రమైన ఇబ్బంది కలుగుతోంది. సంబంధిత విభాగ అధికారులు వెంటనే స్థలాన్ని పరిశీలించి తగిన మరమ్మతులు చేపట్టాలని కోరుతున్నాము.`;
  } else {
    enhanced = `Civic Grievance regarding ${cat}: ${enhanced.charAt(0).toUpperCase() + enhanced.slice(1)}${enhanced.endsWith('.') ? '' : '.'} This condition causes significant inconvenience and safety risks to residents and commuters in the vicinity. Immediate inspection and remedial action by the concerned municipal department is urgently requested.`;
  }

  return {
    improvedText: enhanced,
    source: 'Rule-Based Engine (Fallback)',
    language: isTelugu ? 'te' : 'en'
  };
}

// ── 7. CIVICBOT INTELLIGENT RULE-BASED ENGINE (English & Telugu) ──
function ruleBasedCivicBot({ message, language = 'en', user = null, userComplaints = [], publicComplaints = [] }) {
  const lower = (message || '').toLowerCase().trim();
  const isTe = language === 'te' || /[\u0C00-\u0C7F]/.test(message);

  // 1. User Complaint Status / History
  if (lower.includes('my complaint') || lower.includes('my status') || lower.includes('check status') || lower.includes('track') || lower.includes('నా ఫిర్యాదు') || lower.includes('స్టేటస్') || lower.includes('ట్రాక్')) {
    if (!user) {
      if (isTe) {
        return {
          reply: `మీ ఫిర్యాదుల స్థితిని చూడటానికి, దయచేసి ముందుగా లాగిన్ అవ్వండి. లాగిన్ అయిన తర్వాత మీ డాష్‌బోర్డ్ లేదా **My Complaints** పేజీలో మీ ఫిర్యాదుల వివరాలు కనిపిస్తాయి.\n\n👉 [లాగిన్ పేజీకి వెళ్లండి](/login.html)`,
          provider: 'Rule-Based Engine (CivicPulse Database Connected)'
        };
      }
      return {
        reply: `To view your personalized complaint status, please sign in first. Once logged in, CivicBot can retrieve your live grievance milestones, or you can check **My Complaints** in the Citizen Portal.\n\n👉 [Sign In to Your Account](/login.html)`,
        provider: 'Rule-Based Engine (CivicPulse Database Connected)'
      };
    }

    if (userComplaints.length === 0) {
      if (isTe) {
        return {
          reply: `నమస్కారం ${user.name}! మీ ఖాతాలో ఇంకా ఎటువంటి ఫిర్యాదులు నమోదు కాలేదు. మీరు కొత్త సమస్యను నమోదు చేయాలనుకుంటే **Report Grievance** పేజీని సందర్శించండి.\n\n👉 [సమస్యను నివేదించండి](/report-issue.html)`,
          provider: 'Rule-Based Engine (CivicPulse Database Connected)'
        };
      }
      return {
        reply: `Hello ${user.name}! You have not submitted any civic complaints yet. If you noticed a municipal issue in your neighborhood, you can lodge it right away.\n\n👉 [Lodge a Civic Grievance](/report-issue.html)`,
        provider: 'Rule-Based Engine (CivicPulse Database Connected)'
      };
    }

    if (isTe) {
      let list = userComplaints.map((c, i) => 
        `**${i + 1}. #${c.complaint_id}** — *${c.title}*\n   • విభాగం: **${c.category}** | ప్రాధాన్యత: **${c.priority}**\n   • స్థితి: **${c.status}**\n   • ప్రదేశం: ${c.address || 'నగరం'}\n   • [లైవ్ ట్రాకింగ్ చూడండి](/complaint-details.html?id=${c.complaint_id})`
      ).join('\n\n');

      return {
        reply: `నమస్కారం ${user.name}! మీ ఖాతాలో నమోదైన తాజా ఫిర్యాదులు ఇక్కడ ఉన్నాయి:\n\n${list}\n\nపూర్తి వివరాలకు మీ [My Complaints](/my-complaints.html) పేజీని సందర్శించండి.`,
        provider: 'Rule-Based Engine (CivicPulse Database Connected)'
      };
    }

    let list = userComplaints.map((c, i) => 
      `**${i + 1}. #${c.complaint_id}** — *${c.title}*\n   • Category: **${c.category}** | Priority: **${c.priority}**\n   • Status: **${c.status}**\n   • Location: ${c.address || 'Municipal Ward'}\n   • [View Live Tracking](/complaint-details.html?id=${c.complaint_id})`
    ).join('\n\n');

    return {
      reply: `Hello ${user.name}! Here are your recent grievance tickets recorded in the CivicPulse database:\n\n${list}\n\nYou can track field crew progress on any ticket using the links above or in [My Complaints](/my-complaints.html).`,
      provider: 'Rule-Based Engine (CivicPulse Database Connected)'
    };
  }

  // 2. Nearby / Public Complaints
  if (lower.includes('nearby') || lower.includes('public') || lower.includes('recent issue') || lower.includes('around') || lower.includes('సమీప') || lower.includes('పబ్లిక్') || lower.includes('పరిసరాల్లో')) {
    if (publicComplaints.length === 0) {
      if (isTe) {
        return {
          reply: `ప్రస్తుతం మీ పరిసరాల్లో పెండింగ్‌లో ఉన్న పబ్లిక్ ఫిర్యాదులు ఏవీ లేవు. అన్ని పబ్లిక్ సమస్యలు మరియు జియో మ్యాప్ చూడటానికి క్రింది లింక్ ఉపయోగించండి.\n\n👉 [ఇంటరాక్టివ్ సివిక్ మ్యాప్](/public-map.html)`,
          provider: 'Rule-Based Engine (CivicPulse Database Connected)'
        };
      }
      return {
        reply: `Currently there are no active open public complaints in this immediate perimeter. You can view all city-wide reported issues on the map.\n\n👉 [Explore Interactive Map](/public-map.html)`,
        provider: 'Rule-Based Engine (CivicPulse Database Connected)'
      };
    }

    if (isTe) {
      let list = publicComplaints.map((c, i) => 
        `**${i + 1}. #${c.complaint_id}** — *${c.title}*\n   • విభాగం: **${c.category}**\n   • ప్రాంతం: ${c.address || 'నగరం'}\n   • స్థితి: **${c.status}**`
      ).join('\n\n');

      return {
        reply: `మీ నగరంలో నమోదైన తాజా పబ్లిక్ సమస్యలు (గోప్యతా నిబంధనల ప్రకారం వ్యక్తిగత వివరాలు చూపబడవు):\n\n${list}\n\nఈ సమస్యలను సమగ్రంగా చూడటానికి మా [పబ్లిక్ ఇష్యూస్](/public-issues.html) లేదా [మ్యాప్](/public-map.html) పేజీని సందర్శించండి.`,
        provider: 'Rule-Based Engine (CivicPulse Database Connected)'
      };
    }

    let list = publicComplaints.map((c, i) => 
      `**${i + 1}. #${c.complaint_id}** — *${c.title}*\n   • Category: **${c.category}**\n   • Approximate Area: ${c.address || 'City Zone'}\n   • Status: **${c.status}**`
    ).join('\n\n');

    return {
      reply: `Here are recently reported public grievances in the city (private citizen details are protected):\n\n${list}\n\nYou can explore these geotagged locations on the [Interactive Map](/public-map.html) or [Public Issues Board](/public-issues.html).`,
      provider: 'Rule-Based Engine (CivicPulse Database Connected)'
    };
  }

  // 3. Status Explanations (Pending, Reviewed, Assigned, In Progress, Resolved)
  if (lower.includes('pending') || lower.includes('in progress') || lower.includes('resolved') || lower.includes('status mean') || lower.includes('స్టేటస్ అర్ధం')) {
    if (isTe) {
      return {
        reply: `CivicPulse లో ఫిర్యాదుల స్థితిగతుల వివరణ:\n\n• 🟡 **Pending (పెండింగ్):** ఫిర్యాదు విజయవంతంగా నమోదైంది. కంట్రోల్ రూమ్ అధికారుల పరిశీలన కోసం వేచి ఉంది.\n• 🔵 **Reviewed (పరిశీలించబడింది):** మున్సిపల్ అధికారులు ఫిర్యాదును పరిశీలించి, నిర్ధారించారు.\n• 🟢 **Assigned (కేటాయించబడింది):** సంబంధిత ఇంజనీరింగ్ లేదా క్షేత్రస్థాయి విభాగానికి వర్క్ ఆర్డర్ కేటాయించబడింది.\n• 🟣 **In Progress (పురోగతిలో ఉంది):** ఫీల్డ్ వర్కర్లు క్షేత్రస్థాయిలో మరమ్మతు పనులు చేస్తున్నారు.\n• ✅ **Resolved (పరిష్కరించబడింది):** సమస్య పరిష్కరించబడింది మరియు బిఫోర్-ఆఫ్టర్ ఫోటోలతో ధృవీకరించబడింది.`,
        provider: 'Rule-Based Engine'
      };
    }
    return {
      reply: `Here is what each grievance milestone status means in CivicPulse:\n\n• 🟡 **Pending:** Your complaint has been successfully registered and is queued for triage by the municipal control room.\n• 🔵 **Reviewed:** A municipal officer has verified your report and confirmed category/urgency.\n• 🟢 **Assigned:** A formal work order has been dispatched to the relevant department (e.g., Roads, Water Supply).\n• 🟣 **In Progress:** Field crews and machinery are actively working on ground to fix the issue.\n• ✅ **Resolved:** The repair is complete, verified by field inspection, and certified with before-and-after photo proof.`,
      provider: 'Rule-Based Engine'
    };
  }

  // 4. Duplicate Detection Explanation
  if (lower.includes('duplicate') || lower.includes('similar') || lower.includes('డూప్లికేట్') || lower.includes('ఒకే సమస్య')) {
    if (isTe) {
      return {
        reply: `**డూప్లికేట్ డిటెక్షన్ ఎలా పనిచేస్తుంది:**\n\n1. మీరు ఫిర్యాదు నమోదు చేస్తున్నప్పుడు, మా స్మార్ట్ వ్యవస్థ 600 మీటర్ల పరిధిలోని ఇతర ఫిర్యాదులను స్వయంచాలకంగా తనిఖీ చేస్తుంది.\n2. ఒకే సమస్యపై ఇప్పటికే ఫిర్యాదు ఉంటే, మీకు ఒక హెచ్చరిక చూపిస్తుంది.\n3. మీరు ఆ ఇప్పటికే ఉన్న ఫిర్యాదును **Support (మద్దతు)** ఇవ్వవచ్చు (దీనివల్ల ప్రాధాన్యత పెరుగుతుంది), లేదా ఇది వేరే సమస్య అయితే కొత్త ఫిర్యాదుగా సమర్పించవచ్చు.\n4. ఎట్టి పరిస్థితుల్లోనూ మీ ఫిర్యాదు స్వయంచాలకంగా తిరస్కరించబడదు.`,
        provider: 'Rule-Based Engine'
      };
    }
    return {
      reply: `**How Duplicate Complaint Detection Works in CivicPulse:**\n\n1. When you enter coordinates and a description, CivicPulse automatically scans active grievances within a 600-meter radius.\n2. It analyzes geographic proximity, category, and textual similarity.\n3. If a match is found, you are shown the existing ticket and have the option to **Support** it (increasing its priority weight) or lodge a distinct ticket.\n4. **Your complaint is never automatically discarded**—you always retain full control.`,
      provider: 'Rule-Based Engine'
    };
  }

  // 5. Reporting Potholes / Road Damage
  if (lower.includes('pothole') || lower.includes('road damage') || lower.includes('crater') || lower.includes('గుంత') || lower.includes('రోడ్డు పాడైంది')) {
    if (isTe) {
      return {
        reply: `**రోడ్డు గుంతలు (Potholes) నివేదించే విధానం:**\n\n1. [Report Grievance](/report-issue.html) పేజీని తెరవండి.\n2. వర్గంలో **Road Damage** ఎంచుకోండి.\n3. గుంత స్పష్టంగా కనిపించేలా ఫోటోను అప్‌లోడ్ చేయండి.\n4. లొకేషన్ సెర్చ్ చేయండి లేదా మ్యాప్‌పై పిన్ క్లిక్ చేయండి.\n5. వివరణ రాసి **Submit Grievance** బటన్ నొక్కండి. మా ఇంజనీరింగ్ విభాగం త్వరలోనే స్పందిస్తుంది!`,
        provider: 'Rule-Based Engine'
      };
    }
    return {
      reply: `**How to Report a Pothole or Road Damage:**\n\n1. Open the [Report an Issue](/report-issue.html) form.\n2. Select **Road Damage** under Category.\n3. Upload a clear photograph of the road crater or fissure.\n4. Search your address or click directly on the interactive map to lock GPS coordinates.\n5. Provide a short description (use our AI Auto-Fill / Improve feature) and hit **Submit Grievance**!`,
      provider: 'Rule-Based Engine'
    };
  }

  // 6. Garbage Overflow / Waste
  if (lower.includes('garbage') || lower.includes('trash') || lower.includes('waste') || lower.includes('dump') || lower.includes('చెత్త') || lower.includes('డంప్')) {
    if (isTe) {
      return {
        reply: `**చెత్త సమస్యలు (Garbage Overflow) నివేదించే విధానం:**\n\n1. [Report Grievance](/report-issue.html) పేజీకి వెళ్లండి.\n2. వర్గంలో **Garbage Overflow** ఎంచుకోండి.\n3. చెత్త కుప్ప ఫోటో తీసి అప్‌లోడ్ చేయండి.\n4. వీధి పేరు లేదా ఖచ్చితమైన లొకేషన్ ఎంచుకోండి.\n5. సమర్పించండి! శానిటేషన్ విభాగం సత్వరమే శుభ్రత చర్యలు తీసుకుంటుంది.`,
        provider: 'Rule-Based Engine'
      };
    }
    return {
      reply: `**How to Report Garbage Overflow & Sanitation Hazards:**\n\n1. Navigate to [Report Grievance](/report-issue.html).\n2. Select **Garbage Overflow** in the category dropdown.\n3. Attach a photo showing the uncollected waste.\n4. Pinpoint the street location on the Leaflet map.\n5. Click **Submit Grievance**. The Municipal Solid Waste Management team will be notified immediately.`,
      provider: 'Rule-Based Engine'
    };
  }

  // 7. Water Leakage / Pipeline Burst
  if (lower.includes('water') || lower.includes('leak') || lower.includes('pipe') || lower.includes('burst') || lower.includes('నీరు వృధా') || lower.includes('పైప్ లీక్')) {
    if (isTe) {
      return {
        reply: `**మంచినీటి పైప్‌లైన్ లీకేజీలను నివేదించే విధానం:**\n\n1. [Report Grievance](/report-issue.html) పేజీని తెరవండి.\n2. వర్గంలో **Water Leakage** ఎంచుకోండి.\n3. నీరు కారుతున్న పైప్ ఫోటో అప్‌లోడ్ చేయండి.\n4. ప్రాధాన్యతను **High** లేదా **Critical** (పైప్ పగిలితే) గా ఎంచుకోండి.\n5. చిరునామా నమోదు చేసి సమర్పించండి. వాటర్ సప్లై బోర్డ్ వెంటనే స్పందిస్తుంది.`,
        provider: 'Rule-Based Engine'
      };
    }
    return {
      reply: `**How to Report Water Pipeline Leakage:**\n\n1. Open [Report Grievance](/report-issue.html).\n2. Choose **Water Leakage** under Category.\n3. Upload a photo displaying the leaking or ruptured main line.\n4. Set Urgency to **High** or **Critical** if clean water is causing flooding.\n5. Pinpoint the location on the map and click **Submit Grievance** for priority dispatch.`,
      provider: 'Rule-Based Engine'
    };
  }

  // 8. Drainage / Sewage / Manhole
  if (lower.includes('drain') || lower.includes('sewage') || lower.includes('manhole') || lower.includes('కాలువ') || lower.includes('మురుగునీరు')) {
    if (isTe) {
      return {
        reply: `**మురుగు కాలువలు లేదా తెరిచిన మ్యాన్‌హోల్స్ నివేదించే విధానం:**\n\n1. [Report Grievance](/report-issue.html) కి వెళ్లండి.\n2. వర్గంలో **Drainage Problems** ఎంచుకోండి.\n3. ఒకవేళ మ్యాన్‌హోల్ తెరిచి ఉంటే ప్రాధాన్యతను **Critical** గా పెట్టండి.\n4. ఫోటో మరియు కచ్చితమైన లొకేషన్ జతచేసి సమర్పించండి. ప్రమాదాలు జరగకముందే అధికారులు సరిచేస్తారు.`,
        provider: 'Rule-Based Engine'
      };
    }
    return {
      reply: `**How to Report Drainage & Open Manhole Emergencies:**\n\n1. Go to [Report Grievance](/report-issue.html).\n2. Select **Drainage Problems** in the category menu.\n3. If an open manhole presents a deadly hazard, set Priority to **Critical**.\n4. Attach a photo and tag the GPS coordinates.\n5. Submit immediately so emergency municipal sewer squads are deployed.`,
      provider: 'Rule-Based Engine'
    };
  }

  // 9. Streetlight Failure
  if (lower.includes('streetlight') || lower.includes('light') || lower.includes('dark') || lower.includes('స్ట్రీట్ లైట్') || lower.includes('లైట్లు వెలగట్లేదు')) {
    if (isTe) {
      return {
        reply: `**స్ట్రీట్ లైట్ సమస్యలు నివేదించే విధానం:**\n\n1. [Report Grievance](/report-issue.html) పేజీని తెరవండి.\n2. **Streetlight Failure** ఎంచుకోండి.\n3. స్తంభం నంబర్ లేదా ల్యాండ్‌మార్క్ వివరణలో పేర్కొనండి.\n4. మ్యాప్‌లో ప్రదేశం గుర్తించి ఫిర్యాదు సమర్పించండి. విద్యుత్ విభాగం బల్బు/వైరింగ్ బాగుచేస్తుంది.`,
        provider: 'Rule-Based Engine'
      };
    }
    return {
      reply: `**How to Report Defective Streetlights:**\n\n1. Go to [Report Grievance](/report-issue.html).\n2. Choose **Streetlight Failure** from the category list.\n3. Note the pole number or street crossing in the description.\n4. Confirm location and submit. The municipal electrical wing will handle replacement.`,
      provider: 'Rule-Based Engine'
    };
  }

  // 10. How Administrators Resolve Complaints
  if (lower.includes('admin') || lower.includes('resolve') || lower.includes('officials fix') || lower.includes('పరిష్కరిస్తారు')) {
    if (isTe) {
      return {
        reply: `**మున్సిపల్ అధికారులు ఫిర్యాదులను ఎలా పరిష్కరిస్తారు:**\n\n1. **పరిశీలన (Triage):** కంట్రోల్ రూమ్ అధికారులు ఫిర్యాదు మరియు ఫోటోను తనిఖీ చేస్తారు.\n2. **వర్క్ ఆర్డర్:** తగిన విభాగానికి (రోడ్లు, డ్రైనేజ్ మొదలైనవి) పంపుతారు.\n3. **ఫీల్డ్ వర్క్:** ఇంజనీర్లు మరియు వర్కర్లు స్థలానికి వెళ్లి మరమ్మతు చేస్తారు.\n4. **గ్రౌండ్ వెరిఫికేషన్:** పనులు పూర్తయిన తర్వాత ఆ స్థలం ఫోటో (After Photo) తీసి సిస్టమ్‌లో అప్‌లోడ్ చేస్తారు.\n5. **ధృవీకరణ:** పౌరులు లైవ్ ట్రాకింగ్‌లో బిఫోర్-ఆఫ్టర్ ఫోటోలను స్వయంగా పరిశీలించవచ్చు!`,
        provider: 'Rule-Based Engine'
      };
    }
    return {
      reply: `**How Municipal Administrators Resolve Grievances:**\n\n1. **Triage & Review:** Municipal officers review the AI categorization, geotag, and evidence photo.\n2. **Work Order Dispatch:** The ticket is routed directly to the specialized department (e.g. Sanitation, Roads, Electricity).\n3. **Field Crew Deployment:** Repair teams arrive on-site with required machinery.\n4. **Proof of Resolution:** The field supervisor takes a real-time "After" photograph of the repaired site.\n5. **Citizen Verification:** The status updates to **Resolved** and citizens can inspect the Before/After photos in [Live Tracking](/complaint-details.html)!`,
      provider: 'Rule-Based Engine'
    };
  }

  // 11. Website Navigation
  if (lower.includes('website') || lower.includes('pages') || lower.includes('navigate') || lower.includes('ఎక్కడ') || lower.includes('పేజీలు')) {
    if (isTe) {
      return {
        reply: `CivicPulse లోని ముఖ్యమైన పేజీలు:\n\n• [హోమ్ పేజీ](/index.html) — ప్లాట్‌ఫారమ్ వివరాలు\n• [ఫిర్యాదు చేయండి](/report-issue.html) — కొత్త సమస్య నమోదు\n• [నా ఫిర్యాదులు](/my-complaints.html) — మీ టికెట్లు & ట్రాకింగ్\n• [పబ్లిక్ ఇష్యూస్](/public-issues.html) — నగరంలోని అన్ని సమస్యలు\n• [ఇంటరాక్టివ్ మ్యాప్](/public-map.html) — జియో లొకేషన్ మ్యాప్\n• [ఎలా పనిచేస్తుంది](/how-it-works.html) — పూర్తి ప్రక్రియ వివరాలు`,
        provider: 'Rule-Based Engine'
      };
    }
    return {
      reply: `Here are the key portals across CivicPulse:\n\n• [Home](/index.html) — Platform overview and city metrics\n• [Report Issue](/report-issue.html) — Lodge a new grievance with AI assistance\n• [My Complaints](/my-complaints.html) — Your tickets and live milestone tracking\n• [Public Issues](/public-issues.html) — City-wide grievance board\n• [Interactive Map](/public-map.html) — Real-time OpenStreetMap issue map\n• [How It Works](/how-it-works.html) — 5-step accountability lifecycle`,
      provider: 'Rule-Based Engine'
    };
  }

  // Default Greeting / General Civic Response
  if (isTe) {
    return {
      reply: `నమస్కారం! నేను **CivicBot**, మీ CivicPulse AI సహాయకుడిని. 🏛️\n\nనేను మీకు ఈ విషయాల్లో సహాయం చేయగలను:\n• రోడ్డు గుంతలు, చెత్త, మంచినీటి లీకేజీలు, డ్రైనేజీ లేదా స్ట్రీట్ లైట్ల సమస్యలు నమోదు చేయడం\n• మీ ఫిర్యాదుల లైవ్ స్టేటస్ తనిఖీ చేయడం\n• నగరంలో నమోదైన ఇతర పబ్లిక్ సమస్యల వివరాలు చూడటం\n• ఫిర్యాదుల పరిష్కార ప్రక్రియ మరియు డూప్లికేట్ డిటెక్షన్ తెలుసుకోవడం\n\nమీరు ఏ సమాచారం తెలుసుకోవాలనుకుంటున్నారో అడగండి!`,
      provider: 'Rule-Based Engine'
    };
  }

  return {
    reply: `Hello! I am **CivicBot**, your CivicPulse AI Assistant. 🏛️\n\nI can help you with:\n• Reporting potholes, garbage dumps, water leaks, streetlights, or drainage issues\n• Checking the live progress of your complaints\n• Finding open civic issues reported across the city\n• Explaining Pending, In Progress, and Resolved milestones\n• Guiding you through website features\n\nWhat civic issue or question can I assist you with today?`,
    provider: 'Rule-Based Engine'
  };
}

// ── 8. MAIN CIVICBOT ORCHESTRATOR ─────────────────────────────────
async function generateCivicBotResponse({ message, language = 'en', user = null, conversationHistory = [] }) {
  if (!message || !message.trim()) {
    return {
      reply: language === 'te' ? 'దయచేసి మీ ప్రశ్నను టైప్ చేయండి.' : 'Please enter a message to begin.',
      provider: 'CivicPulse Engine',
      language
    };
  }

  const rawMsg = message.trim();
  const lowerMsg = rawMsg.toLowerCase();
  const isTe = language === 'te' || /[\u0C00-\u0C7F]/.test(rawMsg);
  const detectedLang = isTe ? 'te' : 'en';

  // Step 1: Database Context Retrieval (Strict Privacy Protected)
  let userComplaints = [];
  let publicComplaints = [];
  let specificComplaint = null;

  try {
    // If user is asking about their own complaints and is authenticated
    if (user && user.id && (lowerMsg.includes('my') || lowerMsg.includes('status') || lowerMsg.includes('track') || lowerMsg.includes('history') || isTe)) {
      userComplaints = await dbAsync.all(
        `SELECT complaint_id, title, category, status, priority, address, created_at 
         FROM Complaints 
         WHERE user_id = ? 
         ORDER BY created_at DESC LIMIT 5`,
        [user.id]
      );
    }

    // Check if message references a specific ID like CP-2026-XXXXX
    const idMatch = rawMsg.match(/CP-\d{4}-\d+/i);
    if (idMatch) {
      specificComplaint = await dbAsync.get(
        `SELECT c.complaint_id, c.title, c.category, c.status, c.priority, c.address, c.created_at, d.department_name
         FROM Complaints c
         LEFT JOIN Departments d ON c.department_id = d.id
         WHERE c.complaint_id = ? LIMIT 1`,
        [idMatch[0].toUpperCase()]
      );
    }

    // If query asks about nearby / public issues
    if (lowerMsg.includes('nearby') || lowerMsg.includes('public') || lowerMsg.includes('recent') || lowerMsg.includes('around') || lowerMsg.includes('city') || isTe) {
      publicComplaints = await dbAsync.all(
        `SELECT complaint_id, title, category, address, status, created_at 
         FROM Complaints 
         WHERE status != 'Resolved' 
         ORDER BY created_at DESC LIMIT 5`
      );
    }
  } catch (dbErr) {
    console.warn('CivicBot DB context retrieval warning:', dbErr.message);
  }

  // Step 2: Assemble System Prompt with Database Context
  let dbContextText = '';
  if (user && userComplaints.length > 0) {
    dbContextText += `\nLOGGED IN CITIZEN COMPLAINTS FOR (${user.name}):\n` + 
      userComplaints.map(c => `- #${c.complaint_id}: "${c.title}" [Category: ${c.category}, Status: ${c.status}, Priority: ${c.priority}, Location: ${c.address || 'Local Ward'}]`).join('\n');
  } else if (user) {
    dbContextText += `\nLOGGED IN CITIZEN (${user.name}): Has 0 submitted complaints in database.\n`;
  } else {
    dbContextText += `\nUSER STATUS: Anonymous / Not Logged In. (If they ask for their personal complaints, politely invite them to sign in).\n`;
  }

  if (specificComplaint) {
    dbContextText += `\nSPECIFIC TICKET QUERIED: #${specificComplaint.complaint_id}\n` +
      `Title: "${specificComplaint.title}", Status: ${specificComplaint.status}, Category: ${specificComplaint.category}, Location: ${specificComplaint.address}, Assigned Dept: ${specificComplaint.department_name || 'Under Review'}\n`;
  }

  if (publicComplaints.length > 0) {
    dbContextText += `\nRECENT PUBLIC OPEN COMPLAINTS IN DATABASE (Safe public summary):\n` +
      publicComplaints.map(c => `- #${c.complaint_id}: ${c.category} at ${c.address || 'City Zone'} (Status: ${c.status})`).join('\n');
  }

  const systemInstruction = `You are CivicBot, an intelligent, empathetic civic assistant for the CivicPulse municipal grievance platform.
Your purpose is to assist citizens with municipal concerns (potholes, garbage, water leaks, streetlights, drainage, road damage), guide them on filing complaints, checking status, understanding administrative milestones, and navigating the platform.

Color Theme: Navy Blue (#172554), Teal (#0D9488), Purple (#7C3AED), White.
Platform Portals:
- /report-issue.html (Report Grievance)
- /my-complaints.html (My Complaints & Tracking)
- /public-issues.html (Public Issues List)
- /public-map.html (Interactive Map)
- /login.html (Sign In)

REAL DATABASE CONTEXT (LIVE FROM CIVICPULSE SQLITE):
${dbContextText}

STRICT OPERATIONAL RULES:
1. PRIVACY: Never reveal private citizen details (names, phone numbers, email addresses) of other people.
2. ACCURACY: DO NOT invent fake complaint IDs, fictitious locations, or imaginary repair records. If the database context above has no matching records, state so truthfully.
3. LANGUAGE: If target language is Telugu ('te') or the citizen wrote in Telugu script, respond in fluent, respectful, grammatically natural Telugu (తెలుగు). If English, respond in clear, professional English.
4. FORMAT: Use clear bullet points and markdown links to platform pages when relevant.
5. MILESTONES:
   - Pending: Registered, awaiting municipal triage.
   - Reviewed: Triaged by control room.
   - Assigned: Routed to specific department work crew.
   - In Progress: Field team actively working on-site.
   - Resolved: Fully repaired and verified with before-and-after photographic evidence.
6. DUPLICATES: Explain that CivicPulse scans within 600m to let citizens support existing tickets to increase urgency, but never forces rejection.`;

  // Step 3: Try AI Cascade (Gemini -> Groq)
  const aiResult = await callAiUnified({
    prompt: `Citizen query: "${rawMsg}"\nRespond in: ${detectedLang === 'te' ? 'Telugu (తెలుగు)' : 'English'}`,
    systemInstruction
  });

  if (aiResult && aiResult.text) {
    return {
      reply: aiResult.text,
      provider: aiResult.provider,
      language: detectedLang,
      hasDbContext: userComplaints.length > 0 || publicComplaints.length > 0 || !!specificComplaint
    };
  }

  // Step 4: Fallback to Rule-Based Engine
  const fallback = ruleBasedCivicBot({
    message: rawMsg,
    language: detectedLang,
    user,
    userComplaints,
    publicComplaints
  });

  return {
    reply: fallback.reply,
    provider: fallback.provider,
    language: detectedLang,
    hasDbContext: userComplaints.length > 0 || publicComplaints.length > 0 || !!specificComplaint
  };
}

module.exports = {
  analyzeComplaint,
  improveDescription,
  generateCivicBotResponse,
  ruleBasedClassify,
  ruleBasedSummarize,
  ruleBasedCivicBot
};
