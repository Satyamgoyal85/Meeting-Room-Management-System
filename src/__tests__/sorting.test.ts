/**
 * Unit Tests: Sorting Utilities
 * Tests sortRoomsByCapacityAndName, sortDepartmentsByHierarchy, sortEmployeesByHierarchy
 */

import { describe, it, expect } from 'vitest';
import {
  sortRoomsByCapacityAndName,
  sortDepartmentsByHierarchy,
  sortEmployeesByHierarchy,
  DEFAULT_DEPARTMENT_HIERARCHY_ORDER,
} from '@/lib/sorting';
import { Room, Department, Employee } from '@/lib/types';

// ─── Test Data Factories ───────────────────────────────────────────────────────

function makeRoom(overrides: Partial<Room> & { id: string; name: string; capacity: number }): Room {
  return {
    floor: 'Ground Floor',
    amenities: [],
    is_active: true,
    restricted_to_department_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeDept(id: string, name: string): Department {
  return { id, name, is_restricted_default: false, created_at: new Date().toISOString() };
}

function makeEmployee(overrides: Partial<Employee> & { id: string; name: string }): Employee {
  return {
    auth_user_id: null,
    employee_id: `ECN-${overrides.id}`,
    department_id: null,
    role: 'employee',
    is_active: true,
    must_reset_password: false,
    failed_login_attempts: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Room Sorting Tests ────────────────────────────────────────────────────────

describe('sortRoomsByCapacityAndName', () => {
  it('sorts rooms by capacity ascending', () => {
    const rooms = [
      makeRoom({ id: '1', name: 'Board Room', capacity: 20 }),
      makeRoom({ id: '2', name: 'Room 1', capacity: 4 }),
      makeRoom({ id: '3', name: 'Room 5', capacity: 10 }),
    ];
    const sorted = sortRoomsByCapacityAndName(rooms);
    expect(sorted.map((r) => r.capacity)).toEqual([4, 10, 20]);
  });

  it('sorts rooms with same capacity alphabetically by name (tiebreaker)', () => {
    const rooms = [
      makeRoom({ id: '1', name: 'Room Zeta', capacity: 8 }),
      makeRoom({ id: '2', name: 'Room Alpha', capacity: 8 }),
      makeRoom({ id: '3', name: 'Room Beta', capacity: 8 }),
    ];
    const sorted = sortRoomsByCapacityAndName(rooms);
    expect(sorted.map((r) => r.name)).toEqual(['Room Alpha', 'Room Beta', 'Room Zeta']);
  });

  it('handles numeric room names correctly (natural sort)', () => {
    const rooms = [
      makeRoom({ id: '1', name: 'Room 10', capacity: 8 }),
      makeRoom({ id: '2', name: 'Room 2', capacity: 8 }),
      makeRoom({ id: '3', name: 'Room 1', capacity: 8 }),
    ];
    const sorted = sortRoomsByCapacityAndName(rooms);
    expect(sorted.map((r) => r.name)).toEqual(['Room 1', 'Room 2', 'Room 10']);
  });

  it('returns empty array for empty input', () => {
    expect(sortRoomsByCapacityAndName([])).toEqual([]);
  });

  it('does not mutate original array', () => {
    const rooms = [
      makeRoom({ id: '1', name: 'Room B', capacity: 10 }),
      makeRoom({ id: '2', name: 'Room A', capacity: 4 }),
    ];
    const original = [...rooms];
    sortRoomsByCapacityAndName(rooms);
    expect(rooms[0].name).toBe(original[0].name); // original unchanged
  });
});

// ─── Department Sorting Tests ──────────────────────────────────────────────────

describe('sortDepartmentsByHierarchy', () => {
  it('places Board first', () => {
    const depts = [
      makeDept('1', 'IT'),
      makeDept('2', 'Board'),
      makeDept('3', 'HR'),
    ];
    const sorted = sortDepartmentsByHierarchy(depts);
    expect(sorted[0].name).toBe('Board');
  });

  it('follows the full default hierarchy order', () => {
    const depts = DEFAULT_DEPARTMENT_HIERARCHY_ORDER.map((name, i) => makeDept(String(i), name));
    // Shuffle
    const shuffled = [...depts].reverse();
    const sorted = sortDepartmentsByHierarchy(shuffled);
    expect(sorted.map((d) => d.name)).toEqual(DEFAULT_DEPARTMENT_HIERARCHY_ORDER);
  });

  it('places unknown departments at the end, sorted alphabetically', () => {
    const depts = [
      makeDept('1', 'Zygote Dept'),
      makeDept('2', 'IT'),
      makeDept('3', 'Alpha Unknown'),
    ];
    const sorted = sortDepartmentsByHierarchy(depts);
    expect(sorted[0].name).toBe('IT'); // known hierarchy
    expect(sorted[1].name).toBe('Alpha Unknown'); // unknown, alphabetically first
    expect(sorted[2].name).toBe('Zygote Dept');
  });

  it('accepts a custom hierarchy order override', () => {
    const depts = [makeDept('1', 'Sales'), makeDept('2', 'Marketing'), makeDept('3', 'IT')];
    const customOrder = ['Sales', 'Marketing', 'IT'];
    const sorted = sortDepartmentsByHierarchy(depts, customOrder);
    expect(sorted.map((d) => d.name)).toEqual(['Sales', 'Marketing', 'IT']);
  });
});

// ─── Employee Sorting Tests ────────────────────────────────────────────────────

describe('sortEmployeesByHierarchy', () => {
  const boardDept = makeDept('board-id', 'Board');
  const itDept = makeDept('it-id', 'IT');
  const hrDept = makeDept('hr-id', 'HR');

  it('places System Role = Administrator before Board non-admins and all other departments', () => {
    const employees = [
      makeEmployee({ id: '1', name: 'Zara IT Employee', department_id: 'it-id', role: 'employee' }),
      makeEmployee({ id: '2', name: 'Board Member Non-Admin', department_id: 'board-id', role: 'employee' }),
      makeEmployee({ id: '3', name: 'Rajesh Sharma Admin', department_id: 'it-id', role: 'admin' }),
      makeEmployee({ id: '4', name: 'Ankita Admin', department_id: 'hr-id', role: 'admin' }),
    ];
    const sorted = sortEmployeesByHierarchy(employees, [boardDept, itDept, hrDept]);
    expect(sorted[0].name).toBe('Ankita Admin');
    expect(sorted[1].name).toBe('Rajesh Sharma Admin');
    expect(sorted[2].name).toBe('Board Member Non-Admin');
    expect(sorted[3].name).toBe('Zara IT Employee');
  });

  it('places Board members before regular department employees', () => {
    const employees = [
      makeEmployee({ id: '1', name: 'Zara IT', department_id: 'it-id', role: 'employee' }),
      makeEmployee({ id: '2', name: 'Board Member', department_id: 'board-id', role: 'employee' }),
    ];
    const sorted = sortEmployeesByHierarchy(employees, [boardDept, itDept]);
    expect(sorted[0].name).toBe('Board Member');
  });

  it('sorts employees within same group alphabetically', () => {
    const employees = [
      makeEmployee({ id: '1', name: 'Zara', department_id: 'it-id', role: 'employee' }),
      makeEmployee({ id: '2', name: 'Amit', department_id: 'it-id', role: 'employee' }),
      makeEmployee({ id: '3', name: 'Ritu', department_id: 'it-id', role: 'employee' }),
    ];
    const sorted = sortEmployeesByHierarchy(employees, [itDept]);
    expect(sorted.map((e) => e.name)).toEqual(['Amit', 'Ritu', 'Zara']);
  });

  it('respects department hierarchy order for regular employees', () => {
    const employees = [
      makeEmployee({ id: '1', name: 'IT Emp', department_id: 'it-id', role: 'employee' }),
      makeEmployee({ id: '2', name: 'HR Emp', department_id: 'hr-id', role: 'employee' }),
    ];
    const sorted = sortEmployeesByHierarchy(employees, [itDept, hrDept], ['HR', 'IT']);
    expect(sorted[0].name).toBe('HR Emp');
    expect(sorted[1].name).toBe('IT Emp');
  });
});
