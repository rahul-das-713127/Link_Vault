export function boolFromEnv(v, defaultValue = false) {
  if (v == null || v === '') return defaultValue;
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function getFeaturesFromEnv(env = process.env) {
  return {
    auth: boolFromEnv(env.FEATURE_AUTH, true),
    password: boolFromEnv(env.FEATURE_PASSWORD, true),
    oneTime: boolFromEnv(env.FEATURE_ONE_TIME, true),
    limits: boolFromEnv(env.FEATURE_LIMITS, true),
    manualDelete: boolFromEnv(env.FEATURE_MANUAL_DELETE, true),
    fileTypeValidation: boolFromEnv(env.FEATURE_FILE_TYPE_VALIDATION, true)
  };
}
