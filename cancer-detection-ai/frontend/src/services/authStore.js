const AUTH_USERS_KEY = 'cancer-ai.auth.users.v1';
const AUTH_SESSION_KEY = 'cancer-ai.auth.session.v1';
const AUTH_THEME_KEY = 'cancer-ai.theme.v1';

const DEMO_USERS = [
  {
    id: 'patient-demo',
    role: 'patient',
    fullName: 'Aarav Mehta',
    email: 'patient@demo.health',
    phone: '+91 90000 10001',
    password: 'Patient@123',
    age: '31',
    gender: 'Male',
    bloodGroup: 'O+',
    medicalHistory: 'Family history of hematological monitoring.',
    hospitalName: '',
    medicalRegistrationNumber: '',
    specialization: '',
    experience: '',
    profilePhoto: '',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'doctor-demo',
    role: 'doctor',
    fullName: 'Dr. Nandini Rao',
    email: 'doctor@demo.health',
    phone: '+91 90000 10002',
    password: 'Doctor@123',
    age: '',
    gender: '',
    bloodGroup: '',
    medicalHistory: '',
    hospitalName: 'Geeky Blinders Hospital',
    medicalRegistrationNumber: 'MCI-DR-458102',
    specialization: 'Oncology',
    experience: '11 years',
    profilePhoto: '',
    createdAt: new Date().toISOString(),
  },
];

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadTheme() {
  if (typeof window === 'undefined') return 'dark';
  return 'light';
}

export function saveTheme(theme) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_THEME_KEY, 'light');
}

export function loadUsers() {
  if (typeof window === 'undefined') return DEMO_USERS;
  const existing = safeParse(window.localStorage.getItem(AUTH_USERS_KEY), null);
  if (Array.isArray(existing) && existing.length > 0) {
    return existing;
  }
  window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(DEMO_USERS));
  return DEMO_USERS;
}

export function saveUsers(users) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

export function loadSession() {
  if (typeof window === 'undefined') return null;
  return safeParse(window.localStorage.getItem(AUTH_SESSION_KEY), null);
}

export function saveSession(session) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_SESSION_KEY);
}

export function registerUser(payload) {
  const users = loadUsers();
  const normalizedEmail = payload.email.trim().toLowerCase();

  if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
    throw new Error('An account with this email already exists.');
  }

  const user = {
    id: makeId(payload.role),
    role: payload.role,
    fullName: payload.fullName.trim(),
    email: normalizedEmail,
    phone: payload.phone?.trim() || '',
    password: payload.password,
    age: payload.age?.trim() || '',
    gender: payload.gender || '',
    bloodGroup: payload.bloodGroup || '',
    medicalHistory: payload.medicalHistory?.trim() || '',
    hospitalName: payload.hospitalName?.trim() || '',
    medicalRegistrationNumber: payload.medicalRegistrationNumber?.trim() || '',
    specialization: payload.specialization?.trim() || '',
    experience: payload.experience?.trim() || '',
    profilePhoto: payload.profilePhoto || '',
    createdAt: new Date().toISOString(),
  };

  users.unshift(user);
  saveUsers(users);
  saveSession(user);
  return user;
}

export function loginUser({ role, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const users = loadUsers();
  const user = users.find(
    (item) => item.role === role && item.email.toLowerCase() === normalizedEmail && item.password === password,
  );

  if (!user) {
    throw new Error('Invalid credentials for the selected account type.');
  }

  saveSession(user);
  return user;
}

export function updateSessionUser(updates) {
  const session = loadSession();
  if (!session) return null;

  const nextSession = { ...session, ...updates };
  saveSession(nextSession);

  const users = loadUsers().map((user) => (user.id === session.id ? nextSession : user));
  saveUsers(users);
  return nextSession;
}
