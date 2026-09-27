import { TomTomConfig } from '@tomtom-org/maps-sdk/core';
import { createRequire } from 'module';

// Use createRequire to safely load Node-compatible bundle of web-sdk-services
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ttServicesNode: any = null;

try {
  ttServicesNode = require('@tomtom-international/web-sdk-services/dist/services-node.min.js');
} catch (err) {
  console.warn('[TomTom SDK Client] Failed to load services-node.min.js:', err);
}

/**
 * Ensures the TomTom SDK configuration has the API key loaded from environment
 */
export function initializeTomTomSDK(): { apiKey: string; isConfigured: boolean } {
  const apiKey = process.env.TOMTOM_API_KEY || '';

  if (!apiKey) {
    console.warn('⚠️ [TomTom SDK] TOMTOM_API_KEY is not defined in environment variables.');
    return { apiKey: '', isConfigured: false };
  }

  // Configure official @tomtom-org/maps-sdk global singleton using put()
  if (TomTomConfig.instance) {
    TomTomConfig.instance.put({ apiKey });
  }

  return { apiKey, isConfigured: true };
}

/**
 * Returns the Node-compatible TomTom Web SDK Services instance
 */
export function getTomTomLegacyServices() {
  if (!ttServicesNode) {
    throw new Error('TomTom Web SDK services module not initialized.');
  }
  return ttServicesNode.services;
}
