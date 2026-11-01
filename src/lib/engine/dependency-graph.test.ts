/**
 * Tests for the dependency graph engine.
 * Covers: graph construction, cycle detection, topological sort, validation.
 */

import { describe, it, expect } from 'vitest';
import {
  buildDependencyGraph,
  detectCycles,
  wouldCreateCycle,
  topologicalSort,
  validateDependencies,
} from '@/lib/engine/dependency-graph';
import type { Task } from '@/lib/types/domain';

function makeTask(id: string, title: string, dependsOn: string[] = [], dueDate = ''): Task {
  return {
    id, title, description: '', status: 'pending', priority: 'medium',
    dueDate, assigneeId: '', dependsOn, completedAt: '',
  };
}

describe('Dependency Graph Engine', () => {
  // ─── Graph Construction ───────────────────────────

  describe('buildDependencyGraph', () => {
    it('builds graph from tasks', () => {
      const tasks = [
        makeTask('a', 'A'),
        makeTask('b', 'B', ['a']),
        makeTask('c', 'C', ['a', 'b']),
      ];
      const graph = buildDependencyGraph(tasks);
      expect(graph.get('a')).toEqual([]);
      expect(graph.get('b')).toEqual(['a']);
      expect(graph.get('c')).toEqual(['a', 'b']);
    });

    it('filters out invalid dependency references', () => {
      const tasks = [
        makeTask('a', 'A', ['nonexistent']),
      ];
      const graph = buildDependencyGraph(tasks);
      expect(graph.get('a')).toEqual([]);
    });
  });

  // ─── Cycle Detection ──────────────────────────────

  describe('detectCycles', () => {
    it('returns empty for acyclic graph', () => {
      const tasks = [
        makeTask('a', 'A'),
        makeTask('b', 'B', ['a']),
        makeTask('c', 'C', ['b']),
      ];
      const graph = buildDependencyGraph(tasks);
      expect(detectCycles(graph)).toHaveLength(0);
    });

    it('detects simple two-node cycle', () => {
      const tasks = [
        makeTask('a', 'A', ['b']),
        makeTask('b', 'B', ['a']),
      ];
      const graph = buildDependencyGraph(tasks);
      const cycles = detectCycles(graph);
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('detects three-node cycle', () => {
      const tasks = [
        makeTask('a', 'A', ['c']),
        makeTask('b', 'B', ['a']),
        makeTask('c', 'C', ['b']),
      ];
      const graph = buildDependencyGraph(tasks);
      const cycles = detectCycles(graph);
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('handles disconnected components', () => {
      const tasks = [
        makeTask('a', 'A'),
        makeTask('b', 'B'),
        makeTask('c', 'C', ['d']),
        makeTask('d', 'D', ['c']), // cycle in second component
      ];
      const graph = buildDependencyGraph(tasks);
      const cycles = detectCycles(graph);
      expect(cycles.length).toBeGreaterThan(0);
    });
  });

  // ─── Cycle Prevention ─────────────────────────────

  describe('wouldCreateCycle', () => {
    it('detects self-loop', () => {
      const graph = new Map([['a', []]]);
      expect(wouldCreateCycle(graph, 'a', 'a')).toBe(true);
    });

    it('detects cycle through existing edges', () => {
      // a → b (existing). Adding b → a would create cycle.
      const graph = new Map([['a', ['b']], ['b', []]]);
      expect(wouldCreateCycle(graph, 'b', 'a')).toBe(true);
    });

    it('allows non-circular edge', () => {
      const graph = new Map([['a', []], ['b', []], ['c', []]]);
      expect(wouldCreateCycle(graph, 'b', 'a')).toBe(false);
    });
  });

  // ─── Topological Sort ─────────────────────────────

  describe('topologicalSort', () => {
    it('returns correct order for linear chain', () => {
      const tasks = [
        makeTask('c', 'C', ['b']),
        makeTask('b', 'B', ['a']),
        makeTask('a', 'A'),
      ];
      const graph = buildDependencyGraph(tasks);
      const order = topologicalSort(graph);
      expect(order).not.toBeNull();
      expect(order!.indexOf('a')).toBeLessThan(order!.indexOf('b'));
      expect(order!.indexOf('b')).toBeLessThan(order!.indexOf('c'));
    });

    it('returns null for graph with cycle', () => {
      const tasks = [
        makeTask('a', 'A', ['b']),
        makeTask('b', 'B', ['a']),
      ];
      const graph = buildDependencyGraph(tasks);
      expect(topologicalSort(graph)).toBeNull();
    });

    it('handles independent tasks', () => {
      const tasks = [
        makeTask('a', 'A'),
        makeTask('b', 'B'),
        makeTask('c', 'C'),
      ];
      const graph = buildDependencyGraph(tasks);
      const order = topologicalSort(graph);
      expect(order).not.toBeNull();
      expect(order!.sort()).toEqual(['a', 'b', 'c']);
    });

    it('is deterministic (sorted)', () => {
      const tasks = [
        makeTask('z', 'Z'),
        makeTask('a', 'A'),
        makeTask('m', 'M'),
      ];
      const graph = buildDependencyGraph(tasks);
      const order1 = topologicalSort(graph);
      const order2 = topologicalSort(graph);
      expect(order1).toEqual(order2);
      // Independent tasks should be in sorted order
      expect(order1).toEqual(['a', 'm', 'z']);
    });
  });

  // ─── Dependency Validation ────────────────────────

  describe('validateDependencies', () => {
    it('returns no errors for valid graph', () => {
      const tasks = [
        makeTask('a', 'A'),
        makeTask('b', 'B', ['a']),
      ];
      const results = validateDependencies(tasks);
      expect(results.filter((r) => r.severity === 'error')).toHaveLength(0);
    });

    it('detects self-dependency', () => {
      const tasks = [makeTask('a', 'A', ['a'])];
      const results = validateDependencies(tasks);
      expect(results.some((r) => r.code === 'SELF_DEPENDENCY')).toBe(true);
    });

    it('detects dangling dependency', () => {
      const tasks = [makeTask('a', 'A', ['ghost'])];
      const results = validateDependencies(tasks);
      expect(results.some((r) => r.code === 'DANGLING_DEPENDENCY')).toBe(true);
    });

    it('detects circular dependency', () => {
      const tasks = [
        makeTask('a', 'A', ['b']),
        makeTask('b', 'B', ['a']),
      ];
      const results = validateDependencies(tasks);
      expect(results.some((r) => r.code === 'CIRCULAR_DEPENDENCY')).toBe(true);
    });

    it('warns when task is due before its dependency', () => {
      const tasks = [
        makeTask('a', 'A', [], '2027-06-15T00:00:00Z'),
        makeTask('b', 'B', ['a'], '2027-06-01T00:00:00Z'), // due BEFORE dependency
      ];
      const results = validateDependencies(tasks);
      expect(results.some((r) => r.code === 'DUE_BEFORE_DEPENDENCY')).toBe(true);
    });
  });
});
