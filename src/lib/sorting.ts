import { Department, Employee, Room } from './types';

/**
 * Centralized utility to sort rooms by capacity ascending (smallest to largest).
 * Tiebreaker: sort alphabetically/numerically by room name.
 */
export function sortRoomsByCapacityAndName(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) => {
    if (a.capacity !== b.capacity) {
      return a.capacity - b.capacity;
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Default hierarchy order for departments (Board first, then administrative/core functions, then operational).
 * Note: Subject to user confirmation before being applied strictly across all screens.
 */
export const DEFAULT_DEPARTMENT_HIERARCHY_ORDER: string[] = [
  'Board',
  'HR',
  'Finance',
  'Admin & Operations',
  'Reception',
  'IT',
  'R&D',
  'Marketing',
  'Sales',
  'Production',
  'Quality Assurance',
];

/**
 * Centralized utility to sort departments by hierarchy.
 * Any department not explicitly in the hierarchy order is placed at the end, sorted alphabetically.
 */
export function sortDepartmentsByHierarchy(
  departments: Department[],
  hierarchyOrder: string[] = DEFAULT_DEPARTMENT_HIERARCHY_ORDER
): Department[] {
  return [...departments].sort((a, b) => {
    const idxA = hierarchyOrder.indexOf(a.name);
    const idxB = hierarchyOrder.indexOf(b.name);

    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Centralized utility to sort employees strictly by defined priority rules:
 * 1. All employees with System Role = Administrator (`role === 'admin'`) appear first (`Priority 0`), regardless of department.
 * 2. Board department employees (non-admin) appear next (`Priority 1`).
 * 3. Remaining departments according to hierarchy order: HR → Finance → Admin & Operations → IT → R&D → Marketing → Sales → Production → Quality Assurance.
 * 4. Within each priority group, sort employees alphabetically by name (`name.localeCompare`).
 */
export function sortEmployeesByHierarchy(
  employees: Employee[],
  departments: Department[] = [],
  hierarchyOrder: string[] = DEFAULT_DEPARTMENT_HIERARCHY_ORDER
): Employee[] {
  const deptMap = new Map<string, Department>();
  if (departments && Array.isArray(departments)) {
    departments.forEach((d) => deptMap.set(d.id, d));
  }

  const getPriority = (emp: Employee): number => {
    // Rule 1: All employees with System Role = Administrator (`role === 'admin'`) appear first (`Priority 0`)
    if (emp.role === 'admin') {
      return 0;
    }

    // Resolve department name (either from joined emp.department or deptMap lookup via department_id)
    let deptName: string | undefined = undefined;
    if (emp.department && emp.department.name) {
      deptName = emp.department.name;
    } else if (emp.department_id && deptMap.has(emp.department_id)) {
      deptName = deptMap.get(emp.department_id)?.name;
    }

    // Rule 2: Board department employees (non-admin) next (`Priority 1`)
    if (deptName === 'Board') {
      return 1;
    }

    // Rule 3: Remaining departments in hierarchy order
    if (deptName) {
      const idx = hierarchyOrder.indexOf(deptName);
      if (idx !== -1) {
        // Since 'Board' is at index 0 and gets priority 1, any subsequent department (index >= 1) gets priority 1 + idx (HR = 2, Finance = 3, etc.)
        return 1 + idx;
      }
    }

    // Unknown or unassigned department gets ranked last
    return 999;
  };

  return [...employees].sort((a, b) => {
    const priorityA = getPriority(a);
    const priorityB = getPriority(b);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // Tiebreaker within the exact same priority group: sort alphabetically/numerically by name
    return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' });
  });
}
