// ---- GLOBAL STATE ----
let _sb; // Supabase client (initialized in init.js)

let currentUser = null;
let currentProfile = null;

let savedIds = new Set();

// Primary listings array (populated from DB via refreshListings)
const sampleListings = [];
let displayedListings = [];

// Location filter state
let userZipCoords = null;
let userZipMiles = 5;
let distMilesSchool = 5;
let activeLocTab = 'zip';
let activeHousingType = '';

// Photo upload state
let uploadedPhotos = [];
let existingPhotoUrls = []; // tracks already-saved photos when editing

// UI state
let toastTimer;
let mapInitialized = false;
let leafletMap = null;
let leafletMarkers = [];
let mapPopupId = null;

// Profile page state
const userReviews = {};
let currentProfileListingId = null;
let currentProfileUserId = null;
let pendingStars = 0;
let editAvatarDataUrl = null;
const localProfileData = {};

// ---- APP CONFIG ----
const STRIPE_PK = 'pk_test_51THHVFQ0wcv3gwt9CGylPB3A7FYLeLLr2hXbl5xyPGQ4pQrIsgLd9fkKxGiShP9VgCzUZv5iKtUo0sQq8Ppbu79d00bd1CHtkm';
let stripeInstance = null;
let pendingListingData = null;
let pendingSuccessListingId = null;

const ADMIN_EMAIL = 'brytonsmith13@gmail.com';
const ADMIN_USER_EMAILS = ['brytonsmith13@gmail.com'];

const EMAILJS_SERVICE_ID = 'service_jb14lee';
const EMAILJS_TEMPLATE_ID = 'template_5hs08tg';
const EMAILJS_DEACTIVATE_TEMPLATE_ID = 'YOUR_DEACTIVATE_TEMPLATE_ID'; // replace after creating template
const EMAILJS_PUBLIC_KEY = 'joAABohraXdcGo6yO';

// ---- STATIC DATA ----
// Zip code → approximate lat/lng (Utah college zip codes)
const zipCoords = {
  '84601': { lat: 40.2338, lng: -111.6585, city: 'Provo' },
  '84602': { lat: 40.2518, lng: -111.6493, city: 'Provo (BYU)' },
  '84603': { lat: 40.2440, lng: -111.6600, city: 'Provo' },
  '84604': { lat: 40.2650, lng: -111.6380, city: 'Provo' },
  '84606': { lat: 40.2200, lng: -111.6450, city: 'Provo' },
  '84058': { lat: 40.2969, lng: -111.6945, city: 'Orem (UVU)' },
  '84097': { lat: 40.3100, lng: -111.7100, city: 'Orem' },
  '84321': { lat: 41.7455, lng: -111.8340, city: 'Logan (USU)' },
  '84322': { lat: 41.7455, lng: -111.8101, city: 'Logan (USU)' },
  '84112': { lat: 40.7649, lng: -111.8421, city: 'SLC (U of U)' },
  '84108': { lat: 40.7500, lng: -111.8200, city: 'Salt Lake City' },
  '84102': { lat: 40.7530, lng: -111.8850, city: 'Salt Lake City' },
  '84103': { lat: 40.7800, lng: -111.8800, city: 'Salt Lake City' },
};

// School coords for distance calculation
const schoolCoords = {
  'BYU':        { lat: 40.2518, lng: -111.6493 },
  'UVU':        { lat: 40.2969, lng: -111.6945 },
  'Utah State': { lat: 41.7455, lng: -111.8101 },
  'U of U':     { lat: 40.7649, lng: -111.8421 },
};
