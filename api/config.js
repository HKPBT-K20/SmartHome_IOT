function parseJsonEnv(name) {
  const raw = process.env[name];
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function pickFirebaseConfig() {
  const jsonConfig = parseJsonEnv("FIREBASE_CONFIG_JSON");
  if (jsonConfig && typeof jsonConfig === "object") {
    return jsonConfig;
  }

  return {
    apiKey: process.env.FIREBASE_API_KEY || "YOUR_FIREBASE_API_KEY",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "YOUR_FIREBASE_AUTH_DOMAIN",
    databaseURL: process.env.FIREBASE_DATABASE_URL || "YOUR_FIREBASE_DATABASE_URL",
    projectId: process.env.FIREBASE_PROJECT_ID || "YOUR_FIREBASE_PROJECT_ID",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "YOUR_FIREBASE_STORAGE_BUCKET",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "YOUR_FIREBASE_MESSAGING_SENDER_ID",
    appId: process.env.FIREBASE_APP_ID || "YOUR_FIREBASE_APP_ID"
  };
}

function normalizePasswords(raw) {
  if (!raw) {
    return ["123456", "admin123"];
  }

  return String(raw)
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
}

module.exports = (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    FIREBASE_CONFIG: pickFirebaseConfig(),
    MOCK_ACCOUNT: {
      email: firstDefined(process.env.MOCK_ACCOUNT_EMAIL, process.env.MOCK_EMAIL, "hkpbSmartHome@gmail.com"),
      displayName: firstDefined(process.env.MOCK_ACCOUNT_DISPLAY_NAME, process.env.MOCK_DISPLAY_NAME, "Smart Home Admin")
    },
    MOCK_PASSWORD_ALIASES: normalizePasswords(
      process.env.MOCK_PASSWORD_ALIASES ||
      process.env.MOCK_ACCOUNT_PASSWORD ||
      process.env.MOCK_PASSWORD
    )
  });
};
