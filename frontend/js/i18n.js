// Bilingual Telugu & English Dictionary
const translations = {
  en: {
    brand_name: "CivicPulse",
    tagline: "Report. Track. Resolve. Build a Better City.",
    nav_home: "Home",
    nav_about: "About",
    nav_how_it_works: "How It Works",
    nav_public_issues: "Public Issues",
    nav_public_map: "Interactive Map",
    nav_contact: "Contact",
    nav_login: "Login",
    nav_register: "Register",
    nav_dashboard: "Dashboard",
    nav_logout: "Logout",
    hero_title: "Your City. Your Voice. Our Responsibility.",
    hero_subtitle: "Report civic problems, track their progress in real-time, and help build a cleaner, safer, and smarter community.",
    btn_report_issue: "Report an Issue",
    btn_explore_issues: "Explore Public Issues",
    stat_total: "Total Reported Issues",
    stat_resolved: "Issues Resolved",
    stat_in_progress: "In Progress",
    stat_locations: "Active Locations",
    cat_road: "Road Damage",
    cat_garbage: "Garbage Overflow",
    cat_water: "Water Leakage",
    cat_light: "Streetlight Failure",
    cat_drainage: "Drainage Problems",
    cat_infra: "Public Infrastructure",
    cat_other: "Other",
    status_pending: "Pending",
    status_reviewed: "Reviewed",
    status_assigned: "Assigned",
    status_in_progress: "In Progress",
    status_resolved: "Resolved",
    priority_low: "Low",
    priority_medium: "Medium",
    priority_high: "High",
    priority_critical: "Critical",
    quick_actions: "Quick Actions",
    my_complaints: "My Complaints",
    recent_issues: "Recent Public Issues",
    track_complaint: "Track Complaint"
  },
  te: {
    brand_name: "సివిక్‌పల్స్",
    tagline: "సమస్యను నివేదించండి. ట్రాక్ చేయండి. పరిష్కరించండి. ఉత్తమ నగరాన్ని నిర్మించండి.",
    nav_home: "హోమ్",
    nav_about: "మా గురించి",
    nav_how_it_works: "ఇది ఎలా పనిచేస్తుంది",
    nav_public_issues: "ప్రజా సమస్యలు",
    nav_public_map: "నగర పటం (మ్యాప్)",
    nav_contact: "సంప్రదించండి",
    nav_login: "లాగిన్",
    nav_register: "రిజిస్ట్రేషన్",
    nav_dashboard: "డాష్‌బోర్డ్",
    nav_logout: "లాగ్ అవుట్",
    hero_title: "మీ నగరం. మీ గొంతుక. మా బాధ్యత.",
    hero_subtitle: "నగర సమస్యలను వెంటనే నివేదించండి, వాటి పరిష్కారాన్ని ప్రత్యక్షంగా ట్రాక్ చేయండి మరియు పరిశుభ్రమైన, సురక్షితమైన నగరాన్ని నిర్మించడంలో తోడ్పడండి.",
    btn_report_issue: "సమస్యను నివేదించండి",
    btn_explore_issues: "ప్రజా సమస్యలను చూడండి",
    stat_total: "మొత్తం నమోదైన సమస్యలు",
    stat_resolved: "పరిష్కరించబడిన సమస్యలు",
    stat_in_progress: "పురోగతిలో ఉన్నవి",
    stat_locations: "యాక్టివ్ ప్రాంతాలు",
    cat_road: "రోడ్ల నష్టం / గుంతలు",
    cat_garbage: "చెత్త కుప్పలు",
    cat_water: "మంచినీటి పైప్‌లైన్ లీకేజీ",
    cat_light: "వీధి దీపాల సమస్య",
    cat_drainage: "మురుగునీటి కాల్వ సమస్యలు",
    cat_infra: "ప్రజా మౌలిక సదుపాయాలు",
    cat_other: "ఇతర సమస్యలు",
    status_pending: "పెండింగ్‌లో ఉంది",
    status_reviewed: "సమీక్షించబడింది",
    status_assigned: "శాఖకు కేటాయించబడింది",
    status_in_progress: "పురోగతిలో ఉంది",
    status_resolved: "పరిష్కరించబడింది",
    priority_low: "సాధారణ",
    priority_medium: "మధ్యస్థం",
    priority_high: "అత్యవసరం",
    priority_critical: "తీవ్రమైనది",
    quick_actions: "త్వరిత చర్యలు",
    my_complaints: "నా ఫిర్యాదులు",
    recent_issues: "ఇటీవలి ప్రజా సమస్యలు",
    track_complaint: "ఫిర్యాదు ట్రాకింగ్"
  }
};

class I18nManager {
  constructor() {
    this.currentLang = localStorage.getItem('civicpulse_lang') || 'en';
    this.init();
  }

  init() {
    document.documentElement.lang = this.currentLang;
    this.applyTranslations();

    // Listen to language select dropdowns
    document.querySelectorAll('.lang-selector').forEach(select => {
      select.value = this.currentLang;
      select.addEventListener('change', (e) => {
        this.setLanguage(e.target.value);
      });
    });
  }

  setLanguage(lang) {
    if (translations[lang]) {
      this.currentLang = lang;
      localStorage.setItem('civicpulse_lang', lang);
      document.documentElement.lang = lang;
      this.applyTranslations();
    }
  }

  t(key) {
    return translations[this.currentLang]?.[key] || translations['en']?.[key] || key;
  }

  applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key && this.t(key)) {
        if (el.tagName === 'INPUT' && el.placeholder) {
          el.placeholder = this.t(key);
        } else {
          el.textContent = this.t(key);
        }
      }
    });
  }
}

// Global instance
window.i18n = new I18nManager();
