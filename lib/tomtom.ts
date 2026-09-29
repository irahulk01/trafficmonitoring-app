/**
 * lib/tomtom.ts — Legacy compatibility shim
 *
 * This file previously exported TomTom SDK types directly.
 * Now it re-exports the Mappls equivalents under their original names
 * so any files that haven't been updated yet continue to compile.
 *
 * TomTomIncident is aliased to TrafficIncident inside lib/mappls/types.ts
 * so existing code using TomTomIncident still works.
 */
export * from './mappls/index';
