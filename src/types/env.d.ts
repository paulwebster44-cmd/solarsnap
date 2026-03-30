/**
 * Type declarations for EXPO_PUBLIC_ environment variables.
 * These are loaded from .env by Expo CLI at build/start time.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_HF_API_KEY: string;
  }
}
