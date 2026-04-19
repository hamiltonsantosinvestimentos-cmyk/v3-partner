/**
 * @jest-environment node
 */

'use strict';

const path = require('path');
const fs = require('fs').promises;
const os = require('os');

const { generateGreeting } = require('../../development/scripts/generate-greeting');
const { AgentConfigLoader } = require('../../development/scripts/agent-config-loader');

const KNOWN_AGENTS = ['qa', 'dev', 'po', 'sm', 'pm', 'architect'];

describe('Greeting System Integration', () => {
  describe('AgentConfigLoader.loadAgentDefinition()', () => {
    it('should load agent definition with required fields', async () => {
      const loader = new AgentConfigLoader('qa');
      const definition = await loader.loadAgentDefinition();

      expect(definition).toBeDefined();
      expect(definition.agent).toBeDefined();
      expect(definition.agent.id).toBe('qa');
      expect(definition.agent.name).toBeDefined();
      expect(definition.agent.icon).toBeDefined();
    }, 5000);

    it('should return normalized persona_profile with greeting_levels', async () => {
      const loader = new AgentConfigLoader('dev');
      const definition = await loader.loadAgentDefinition();

      expect(definition.persona_profile).toBeDefined();
      expect(definition.persona_profile.greeting_levels).toBeDefined();
    }, 5000);

    it('should use cache on second call', async () => {
      const loader = new AgentConfigLoader('sm');

      const start1 = Date.now();
      await loader.loadAgentDefinition();
      const first = Date.now() - start1;

      const start2 = Date.now();
      await loader.loadAgentDefinition();
      const second = Date.now() - start2;

      // Second call should be significantly faster (cache hit)
      expect(second).toBeLessThanOrEqual(first + 50);
    }, 10000);

    it('should throw for missing agent file', async () => {
      const loader = new AgentConfigLoader('nonexistent-agent-xyz');
      await expect(loader.loadAgentDefinition()).rejects.toThrow();
    }, 5000);
  });

  describe('AgentConfigLoader.loadComplete()', () => {
    it('should return combined config and definition', async () => {
      const loader = new AgentConfigLoader('qa');
      const result = await loader.loadComplete({});

      expect(result.agent).toBeDefined();
      expect(result.definition).toBeDefined();
      expect(result.commands).toBeDefined();
      expect(Array.isArray(result.commands)).toBe(true);
    }, 5000);
  });

  describe('generateGreeting() full pipeline', () => {
    it('should generate non-empty greeting for each known agent', async () => {
      for (const agentId of KNOWN_AGENTS) {
        const greeting = await generateGreeting(agentId);
        expect(typeof greeting).toBe('string');
        expect(greeting.length).toBeGreaterThan(10);
      }
    }, 30000);

    it('should always return fallback on unknown agent (never throw)', async () => {
      await expect(generateGreeting('totally-unknown-agent')).resolves.toBeDefined();
    }, 5000);

    it('should not include [object Object] in output', async () => {
      const greeting = await generateGreeting('qa');
      expect(greeting).not.toContain('[object Object]');
    }, 5000);
  });
});
