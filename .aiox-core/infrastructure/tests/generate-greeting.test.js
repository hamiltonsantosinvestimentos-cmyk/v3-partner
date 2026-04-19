/**
 * @jest-environment node
 */

'use strict';

const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// Point to development scripts
const { generateGreeting } = require('../../development/scripts/generate-greeting');

describe('generateGreeting', () => {
  it('should return a string for valid agent', async () => {
    const greeting = await generateGreeting('qa');
    expect(typeof greeting).toBe('string');
    expect(greeting.length).toBeGreaterThan(0);
  }, 5000);

  it('should return fallback greeting for invalid agent', async () => {
    const greeting = await generateGreeting('invalid-agent-xyz-404');
    expect(typeof greeting).toBe('string');
    expect(greeting).toMatch(/ready|help/i);
  }, 5000);

  it('should return fallback greeting when called with empty string', async () => {
    const greeting = await generateGreeting('');
    expect(typeof greeting).toBe('string');
    expect(greeting.length).toBeGreaterThan(0);
  }, 5000);

  it('should complete within performance target (1000ms)', async () => {
    const start = Date.now();
    await generateGreeting('dev');
    const duration = Date.now() - start;
    // Use relaxed limit in test environment (no cache, cold start)
    expect(duration).toBeLessThan(1000);
  }, 5000);

  it('should use cache and be faster on second call', async () => {
    // First call warms cache
    await generateGreeting('pm');

    const start = Date.now();
    await generateGreeting('pm');
    const duration = Date.now() - start;

    // Cached call should be fast
    expect(duration).toBeLessThan(500);
  }, 10000);
});
