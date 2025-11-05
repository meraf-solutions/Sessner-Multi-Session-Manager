/**
 * Background Compatibility Layer for MV3
 *
 * Provides backwards-compatible wrapper around state_manager.js
 * Allows existing background.js code to work without major refactoring.
 *
 * This module bridges the gap between:
 * - Old pattern: Direct sessionStore object access
 * - New pattern: State manager function calls
 *
 * @module background_compatibility
 */

import {
  getState,
  setState,
  updateState,
  persistState,
  getStateProperty,
  setStateProperty
} from './state_manager.js';

/**
 * Create a Proxy wrapper for sessionStore that forwards to state manager
 * This allows existing code like `sessionStore.sessions[id]` to work
 *
 * @returns {Proxy} Proxied sessionStore object
 */
export function createSessionStoreProxy() {
  const handler = {
    /**
     * Get property from state
     * Example: sessionStore.sessions → getState().sessions
     */
    get(target, prop) {
      const state = getState();
      return state[prop];
    },

    /**
     * Set property in state
     * Example: sessionStore.sessions[id] = {...} → updateState({ sessions: {...} })
     */
    set(target, prop, value) {
      const state = getState();
      state[prop] = value;
      updateState(state);
      return true;
    },

    /**
     * Check if property exists
     * Example: 'sessions' in sessionStore → 'sessions' in getState()
     */
    has(target, prop) {
      const state = getState();
      return prop in state;
    },

    /**
     * Get property names
     * Example: Object.keys(sessionStore) → Object.keys(getState())
     */
    ownKeys(target) {
      const state = getState();
      return Object.keys(state);
    },

    /**
     * Get property descriptor
     */
    getOwnPropertyDescriptor(target, prop) {
      const state = getState();
      if (prop in state) {
        return {
          enumerable: true,
          configurable: true,
          value: state[prop]
        };
      }
      return undefined;
    },

    /**
     * Delete property
     * Example: delete sessionStore.sessions[id]
     */
    deleteProperty(target, prop) {
      const state = getState();
      delete state[prop];
      updateState(state);
      return true;
    }
  };

  // Create proxy with empty target object
  return new Proxy({}, handler);
}

/**
 * Debounced persistence wrapper
 * Matches existing persistSessions() signature
 *
 * @param {boolean} immediate - If true, persist immediately
 * @returns {Promise<void>}
 */
export async function persistSessions(immediate = false) {
  return persistState(immediate);
}

/**
 * Get tabMetadataCache from state
 * Converts Map to object for compatibility
 *
 * @returns {Map} Tab metadata cache
 */
export function getTabMetadataCache() {
  const state = getState();
  const cache = state.tabMetadataCache || {};

  // Convert object to Map if needed
  if (!(cache instanceof Map)) {
    const map = new Map();
    for (const [key, value] of Object.entries(cache)) {
      map.set(parseInt(key), value);
    }
    return map;
  }

  return cache;
}

/**
 * Set tabMetadataCache in state
 * Converts Map to object for storage
 *
 * @param {Map} cache - Tab metadata cache
 */
export function setTabMetadataCache(cache) {
  // Convert Map to object for storage
  const obj = {};
  for (const [key, value] of cache.entries()) {
    obj[key] = value;
  }

  setStateProperty('tabMetadataCache', obj);
}

/**
 * Update single tab metadata entry
 *
 * @param {number} tabId - Tab ID
 * @param {Object} metadata - Tab metadata
 */
export function updateTabMetadata(tabId, metadata) {
  const cache = getTabMetadataCache();
  cache.set(tabId, metadata);
  setTabMetadataCache(cache);
}

/**
 * Delete single tab metadata entry
 *
 * @param {number} tabId - Tab ID
 */
export function deleteTabMetadata(tabId) {
  const cache = getTabMetadataCache();
  cache.delete(tabId);
  setTabMetadataCache(cache);
}

/**
 * Get domainToSessionActivity from state
 *
 * @returns {Object} Domain to session activity map
 */
export function getDomainToSessionActivity() {
  const state = getState();
  return state.domainToSessionActivity || {};
}

/**
 * Set domainToSessionActivity in state
 *
 * @param {Object} activity - Domain to session activity map
 */
export function setDomainToSessionActivity(activity) {
  setStateProperty('domainToSessionActivity', activity);
}

/**
 * Update domain session activity
 *
 * @param {string} domain - Domain name
 * @param {string} sessionId - Session ID
 * @param {number} timestamp - Activity timestamp
 */
export function updateDomainActivity(domain, sessionId, timestamp) {
  const activity = getDomainToSessionActivity();

  if (!activity[domain]) {
    activity[domain] = {};
  }

  activity[domain][sessionId] = timestamp;
  setDomainToSessionActivity(activity);
}

// Export all functions
export default {
  createSessionStoreProxy,
  persistSessions,
  getTabMetadataCache,
  setTabMetadataCache,
  updateTabMetadata,
  deleteTabMetadata,
  getDomainToSessionActivity,
  setDomainToSessionActivity,
  updateDomainActivity
};
