# CIVICPULSE – AI-POWERED SMART CIVIC ISSUE DETECTION & ACCOUNTABILITY PLATFORM

> **Tagline:** Report. Track. Resolve. Build a Better City.  
> **Type:** Real University Innovation Project  
> **Architecture:** Full-Stack Modular (Separated `backend/` and `frontend/`)

---

## 🌟 Executive Summary

**CivicPulse** is an enterprise-grade smart civic grievance redressal and accountability platform built to bridge the gap between citizens, municipal engineering departments, and city governance. The platform integrates:
- **Google Gemini AI & Resilient Rule Engine** for automated category classification, urgency prioritization, and complaint summarization.
- **Geospatial Proximity & Duplicate Cluster Detection** using the Haversine formula and OpenStreetMap coordinates to prevent duplicate tickets and consolidate community upvotes within a 600m radius.
- **OpenStreetMap & Leaflet.js** for real-time interactive public heatmaps, live GPS geolocation, and Nominatim forward/reverse geocoding.
- **Before-and-After Verified Ground Proof** requiring municipal field engineering crews to upload photographic proof of repair before any grievance can be marked resolved.
- **Bilingual Telugu (తెలుగు) & English** localization for democratic public accessibility.
- **In-App & Resend Email Notifications** with structured audit trails at every milestone.

---

## 🏗️ Project Architecture & Directory Layout

```
civicpulse/
├── backend/
│   ├── .env.example              # Template for environment configuration
│   ├── .env                      # Active development environment variables
│   ├── package.json              # Backend dependencies and seed scripts
│   ├── server.js                 # Express server, rate limiter, helmet & static router
│   ├── uploads/                  # Upload directory for problem & resolution evidence
│   └── src/
│       ├── config/
│       │   └── env.js            # Central environment and credentials loader
│       ├── database/
│       │   ├── db.js             # SQLite connection, async wrappers & table schemas
│       │   ├── seed.js           # Database seeder (Departments, Admin, Citizen, Complaints)
│       │   └── civicpulse.db     # Relational SQLite database file
│       ├── middleware/
│       │   ├── auth.js           # JWT authentication, role guards (Citizen vs Admin)
│       │   └── upload.js         # Multer configuration with MIME & size restrictions
│       ├── routes/
│       │   ├── auth.js           # Login, register, profile update, forgot password
│       │   ├── complaints.js     # Citizen complaints submission, timeline, upvotes
│       │   ├── public.js         # Public complaints list, map markers, statistics
│       │   ├── ai.js             # AI classification, summarization, priority suggestions
│       │   ├── admin.js          # Admin dashboard, status transitions, resolution proof
│       │   └── notifications.js  # In-app notifications & read receipts
│       └── services/
│           ├── aiService.js      # Gemini 1.5 Flash client + Rule-based fallback engine
│           ├── duplicateService.js# Haversine distance & token similarity duplicate detector
│           ├── geocodingService.js# Nominatim OSM search & reverse geocoding with caching
│           └── emailService.js   # Resend API email delivery + HTML civic templates
│
└── frontend/
    ├── css/
    │   └── styles.css            # Complete design system (Navy, Teal, Blue, Purple, Green, Orange)
    ├── js/
    │   ├── api.js                # Central API client, JWT injection & Toast notifications
    │   ├── i18n.js               # Telugu & English dictionary & dynamic translation engine
    │   └── components.js         # Global navigation bar, auth header pills & footer
    │
    ├── 1. PUBLIC PAGES
    │   ├── index.html            # Premium landing page with live database statistics
    │   ├── about.html            # About the initiative & technical architecture
    │   ├── how-it-works.html     # Step-by-step citizen-to-resolution pipeline
    │   ├── public-issues.html    # Filterable grid of public grievances & upvoting
    │   ├── public-map.html       # Leaflet OpenStreetMap interactive grievance heatmap
    │   └── contact.html          # Citizen grievance support desk & contact form
    │
    ├── 2. AUTHENTICATION PAGES
    │   ├── login.html            # Unified login for Citizens and Municipal Officials
    │   ├── register.html         # Citizen onboarding with form validation
    │   └── forgot-password.html  # Secure password recovery flow
    │
    ├── 3. CITIZEN PAGES
    │   ├── citizen-dashboard.html# Citizen overview with complaint count cards
    │   ├── report-issue.html     # Grievance lodge form with AI autofill & duplicate warning
    │   ├── my-complaints.html    # Citizen's personal history of lodged grievances
    │   ├── complaint-details.html# 5-step visual timeline & before-and-after proof
    │   ├── notifications.html    # In-app notification center with read status
    │   └── profile.html          # Profile settings and contact details
    │
    └── 4. ADMIN & MUNICIPAL MANAGEMENT PAGES
        ├── admin-dashboard.html  # High-level municipal control room overview
        ├── manage-complaints.html# Complete registry with search, filter, and CSV export
        ├── admin-complaint-details.html# Department assignment, status & repair photo upload
        ├── manage-departments.html# Engineering divisions (Roads, Drainage, Lighting, etc.)
        ├── manage-users.html     # Citizen directory & complaint volume monitoring
        ├── analytics.html        # Chart.js visualizations (Doughnut, Bar, Trends line)
        └── admin-settings.html   # Service integration monitors & credential setup guide
```

---

## 🎨 Color Palette & Design System

The application strictly implements the required modern SaaS and smart-city palette:
- **Navy Blue (`#172554`)**: Primary brand identity, sidebar, headers
- **Teal (`#0D9488`)**: Primary accent, CTA buttons, active status indicator
- **Bright Blue (`#3B82F6`)**: Secondary accents, map highlights, timeline transitions
- **Purple (`#7C3AED`)**: AI indicators, review badges
- **Green (`#16A34A`)**: Verified resolutions, success alerts
- **Orange (`#F59E0B`)**: In-progress status, warning callouts
- **Slate Background (`#F1F5F9`)**: Neutral background with clean white cards and elevation shadows

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18+ recommended)
- npm

### 1. Installation
Navigate into the backend directory and install dependencies:
```bash
cd backend
npm install
```

### 2. Database Initialization & Seed Data
Initialize SQLite relational tables and seed pre-configured departments, realistic complaints across Hyderabad, and demo accounts:
```bash
npm run seed
```

### 3. Start the Server
Start the backend server (serves both API routes and the frontend statically):
```bash
npm start
```

Open your browser and navigate to:
```
http://localhost:5000
```

---

## 🔑 Demo Development Credentials

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Municipal Admin** | `admin@civicpulse.gov` | `Admin@123` | Full Administrative Control, Department Assignment, Resolution Verification |
| **Citizen** | `citizen@civicpulse.org` | `Citizen@123` | Grievance Reporting, Tracking, Upvoting, Personal Dashboard |

---

## 🔌 API Integrations & Fallback Details

| API / Service | Purpose | Fallback Behavior when Key is Missing |
| :--- | :--- | :--- |
| **CivicBot AI Chatbot** | Bilingual floating AI assistant for civic guidance and live tracking | Dual cascade: Google Gemini 1.5 -> Groq Llama 3.3 -> Offline Rule-Based Engine (English & Telugu) connected to live SQLite database. |
| **Google Gemini 1.5** | Suggests categories, summaries, priority scores, and description improvement | Groq Llama 3.3 or local Rule-Based Engine with zero downtime. |
| **Groq (Llama 3.3)** | High-speed backup LLM for conversational AI and grievance drafting | Rule-Based Engine with full keyword heuristics and Telugu support. |
| **OpenStreetMap & Leaflet** | Interactive map tiles and visual markers | Standard OSM public tile server with proper attribution. |
| **Nominatim Geocoding** | Address lookup and reverse lat/lon geocoding | In-memory cache + 1000ms delay to strictly comply with usage policy. |
| **Browser Geolocation** | One-click GPS location pinning | Citizen can search address manually or drag the map pin. |
| **Cloudinary Media** | Photographic evidence and repair verification | **Local Disk Storage**: Files stored in `/backend/uploads` and served directly. |
| **Resend Email API** | Registration and status update emails | **Simulated Logger**: Notification is recorded in backend logs and persistent in-app notifications are created. |
| **Chart.js** | Visual analytics dashboards | Charts compute metrics directly from live SQLite database records. |

---

## 🧪 Testing Checklist

- [x] **Registration & Login**: Secure password hashing with bcrypt, JWT token issued in `localStorage`.
- [x] **Grievance Submission**: Photo upload, GPS map pin, AI classification auto-fill.
- [x] **Duplicate Detection**: Haversine distance radius check with inline upvote / support option.
- [x] **Interactive Public Map**: OpenStreetMap Leaflet pins color-coded by status (Red: Pending, Orange: In Progress, Green: Resolved).
- [x] **Before-and-After Verification**: Side-by-side comparison of original issue and verified repair photo.
- [x] **Role Security**: Citizens are restricted from accessing `/admin-*` or admin API endpoints.
- [x] **Bilingual Support**: Dynamic English and Telugu toggle preserved in `localStorage`.
- [x] **Analytics**: Live Chart.js doughnut, bar, and trend charts.
