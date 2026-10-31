/**
 * Task Dependency Graph Engine.
 *
 * Models task dependencies as a directed acyclic graph (DAG).
 * Provides cycle detection, topological sorting, and dependency resolution.
 * All operations are pure and deterministic.
 */

import type { Task, ValidationResult } from '../types/domain';

/** Adjacency list representation of the dependency graph */
export type DependencyGraph = Map<string, string[]>;

/**
 * Build a dependency graph from a list of tasks.
 * Each task maps to the list of task IDs it depends on.
 */
export function buildDependencyGraph(tasks: Task[]): DependencyGraph {
  const graph: DependencyGraph = new Map();
  const taskIds = new Set(tasks.map((t) => t.id));

  for (const task of tasks) {
    // Only include dependencies that reference existing tasks
    const validDeps = task.dependsOn.filter((depId) => taskIds.has(depId));
    graph.set(task.id, validDeps);
  }

  return graph;
}

/**
 * Detect cycles in the dependency graph using DFS.
 * Returns an array of cycles found, where each cycle is an array of task IDs
 * forming the cycle path.
 *
 * Uses the three-color algorithm:
 * - WHITE (unvisited)
 * - GRAY (currently being explored / on the recursion stack)
 * - BLACK (fully explored, no cycle through this node)
 */
export function detectCycles(graph: DependencyGraph): string[][] {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const cycles: string[][] = [];

  for (const nodeId of graph.keys()) {
    color.set(nodeId, WHITE);
  }

  function dfs(nodeId: string): void {
    color.set(nodeId, GRAY);
    const neighbors = graph.get(nodeId) ?? [];

    for (const neighbor of neighbors) {
      if (!color.has(neighbor)) continue; // Skip references to non-existent nodes

      if (color.get(neighbor) === GRAY) {
        // Found a cycle — reconstruct the cycle path
        const cycle: string[] = [neighbor];
        let current: string | null | undefined = nodeId;
        while (current !== null && current !== undefined && current !== neighbor) {
          cycle.push(current);
          current = parent.get(current) ?? null;
        }
        cycle.push(neighbor); // Close the cycle
        cycle.reverse();
        cycles.push(cycle);
      } else if (color.get(neighbor) === WHITE) {
        parent.set(neighbor, nodeId);
        dfs(neighbor);
      }
    }

    color.set(nodeId, BLACK);
  }

  for (const nodeId of graph.keys()) {
    if (color.get(nodeId) === WHITE) {
      parent.set(nodeId, null);
      dfs(nodeId);
    }
  }

  return cycles;
}

/**
 * Check if adding a dependency would create a cycle.
 * Returns true if adding `fromId -> toId` (fromId depends on toId) creates a cycle.
 */
export function wouldCreateCycle(
  graph: DependencyGraph,
  fromId: string,
  toId: string
): boolean {
  // Adding fromId -> toId means "fromId depends on toId"
  // This creates a cycle if toId can already reach fromId through existing edges
  if (fromId === toId) return true;

  const visited = new Set<string>();

  function canReach(current: string, target: string): boolean {
    if (current === target) return true;
    if (visited.has(current)) return false;
    visited.add(current);

    const deps = graph.get(current) ?? [];
    for (const dep of deps) {
      if (canReach(dep, target)) return true;
    }
    return false;
  }

  // If toId can reach fromId, then adding fromId -> toId creates a cycle
  return canReach(toId, fromId);
}

/**
 * Topological sort of the dependency graph using Kahn's algorithm.
 * Returns task IDs in execution order (dependencies first).
 * Returns null if the graph contains cycles.
 */
export function topologicalSort(graph: DependencyGraph): string[] | null {
  // Calculate in-degrees
  const inDegree = new Map<string, number>();
  for (const nodeId of graph.keys()) {
    inDegree.set(nodeId, 0);
  }

  for (const [, deps] of graph) {
    for (const dep of deps) {
      if (inDegree.has(dep)) {
        inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
      }
    }
  }

  // Wait — the graph edges point FROM a task TO its dependencies.
  // For topological sort, we need "dependency must come before dependent".
  // So we need to reverse the edge direction: dep -> nodeId (dep must be done before nodeId).

  // Build reverse graph for topological ordering
  const reverseGraph = new Map<string, string[]>();
  for (const nodeId of graph.keys()) {
    reverseGraph.set(nodeId, []);
  }
  for (const [nodeId, deps] of graph) {
    for (const dep of deps) {
      if (reverseGraph.has(dep)) {
        reverseGraph.get(dep)!.push(nodeId);
      }
    }
  }

  // Recalculate in-degrees based on reverse graph semantics
  // In the original graph: nodeId depends on dep (nodeId -> dep)
  // For scheduling: dep must come before nodeId
  // In-degree of nodeId = number of dependencies it has
  const schedulingInDegree = new Map<string, number>();
  for (const nodeId of graph.keys()) {
    schedulingInDegree.set(nodeId, (graph.get(nodeId) ?? []).length);
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [nodeId, degree] of schedulingInDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  // Sort the initial queue for deterministic output
  queue.sort();

  const result: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    // For each task that depends on current (i.e., current is in their dependsOn list)
    const dependents = reverseGraph.get(current) ?? [];
    for (const dependent of dependents) {
      const newDegree = (schedulingInDegree.get(dependent) ?? 1) - 1;
      schedulingInDegree.set(dependent, newDegree);
      if (newDegree === 0) {
        queue.push(dependent);
      }
    }

    // Re-sort for determinism when multiple nodes become available
    queue.sort();
  }

  // If we didn't process all nodes, there's a cycle
  if (result.length !== graph.size) {
    return null;
  }

  return result;
}

/**
 * Validate task dependencies and return validation results.
 * Checks: cycles, self-references, dangling references, scheduling conflicts.
 */
export function validateDependencies(tasks: Task[]): ValidationResult[] {
  const results: ValidationResult[] = [];
  const taskIds = new Set(tasks.map((t) => t.id));
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  // Check dangling references and self-dependencies
  for (const task of tasks) {
    for (const depId of task.dependsOn) {
      if (depId === task.id) {
        results.push({
          field: `tasks.${task.id}.dependsOn`,
          message: `Task "${task.title}" depends on itself`,
          severity: 'error',
          code: 'SELF_DEPENDENCY',
        });
      } else if (!taskIds.has(depId)) {
        results.push({
          field: `tasks.${task.id}.dependsOn`,
          message: `Task "${task.title}" depends on non-existent task "${depId}"`,
          severity: 'error',
          code: 'DANGLING_DEPENDENCY',
        });
      }
    }
  }

  // Cycle detection
  const graph = buildDependencyGraph(tasks);
  const cycles = detectCycles(graph);

  for (const cycle of cycles) {
    const cycleNames = cycle
      .map((id) => taskMap.get(id)?.title ?? id)
      .join(' → ');
    results.push({
      field: 'tasks',
      message: `Circular dependency detected: ${cycleNames}`,
      severity: 'error',
      code: 'CIRCULAR_DEPENDENCY',
    });
  }

  // Scheduling conflict: task due before its dependency
  for (const task of tasks) {
    if (task.dueDate === '') continue;
    const taskDue = new Date(task.dueDate);

    for (const depId of task.dependsOn) {
      const dep = taskMap.get(depId);
      if (!dep || dep.dueDate === '') continue;
      const depDue = new Date(dep.dueDate);

      if (taskDue < depDue) {
        results.push({
          field: `tasks.${task.id}.dueDate`,
          message: `Task "${task.title}" is due before its dependency "${dep.title}"`,
          severity: 'warning',
          code: 'DUE_BEFORE_DEPENDENCY',
        });
      }
    }
  }

  return results;
}
