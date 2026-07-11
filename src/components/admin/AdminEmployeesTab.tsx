'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { Employee, Department, Booking } from '@/lib/types';
import { createEmployeeAction, updateEmployeeAction, toggleEmployeeStatusAction, deleteEmployeeAction, adminResetPasswordAction, bulkImportEmployeesAction, BulkImportResultItem } from '@/actions/admin';
import { sortEmployeesByHierarchy } from '@/lib/sorting';
import { 
  Users, 
  UserPlus, 
  Shield, 
  User, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Trash2, 
  Loader2, 
  X, 
  Key,
  Building2,
  KeyRound,
  Copy,
  Check,
  ExternalLink,
  Link2,
  Search,
  Edit3,
  UserX,
  UserCheck,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle,
  FileText
} from 'lucide-react';

interface AdminEmployeesTabProps {
  employees: Employee[];
  departments: Department[];
  bookings?: Booking[];
}

export default function AdminEmployeesTab({
  employees,
  departments,
  bookings,
}: AdminEmployeesTabProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [isPending, startTransition] = useTransition();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Bulk Import state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  interface ParsedRow {
    rowNum: number;
    name: string;
    numericId: string;
    username: string;
    departmentNameInput: string;
    departmentId: string | null;
    role: 'employee' | 'admin';
    isValid: boolean;
    errorReason: string | null;
  }
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

  interface ImportResultSummary {
    successCount: number;
    skippedCount: number;
    importedItems: BulkImportResultItem[];
    skippedItems: Array<{
      rowNum: number;
      name: string;
      numericId: string;
      username: string;
      reason: string;
    }>;
  }
  const [importSummary, setImportSummary] = useState<ImportResultSummary | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [emailUsername, setEmailUsername] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || '');
  const [role, setRole] = useState<'employee' | 'admin'>('employee');

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Hard delete block modal state
  const [blockedDeleteEmp, setBlockedDeleteEmp] = useState<Employee | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string>('');
  const [deletingEmp, setDeletingEmp] = useState<Employee | null>(null);

  // Phase 3 Password Reset Link state
  const [resettingEmp, setResettingEmp] = useState<Employee | null>(null);
  const [generatedResetUrl, setGeneratedResetUrl] = useState<{ url: string; empName: string } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleConfirmResetPassword = () => {
    if (!resettingEmp) return;
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await adminResetPasswordAction(resettingEmp.id);
      if (res.error) {
        setError(res.error);
      } else if (res.resetUrl && res.employeeName) {
        setGeneratedResetUrl({ url: res.resetUrl, empName: res.employeeName });
        setResettingEmp(null);
      }
    });
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const getDynamicPassword = () => {
    if (!emailUsername.trim() || !employeeId.trim()) return 'dhanuka123';
    const cleanUsername = emailUsername.trim().toLowerCase().split(/[\.\-_]/)[0].replace(/[^a-z]/g, '') || emailUsername.trim().toLowerCase().replace(/[^a-z]/g, '');
    const prefix = cleanUsername.slice(0, 4);
    return `${prefix}${employeeId.trim()}`;
  };

  const openCreateModal = () => {
    setName('');
    setEmailUsername('');
    setEmployeeId('');
    setDepartmentId(departments[0]?.id || '');
    setRole('employee');
    setError(null);
    setSuccessMsg(null);
    setEditingEmp(null);
    setIsCreating(true);
  };

  const openImportModal = () => {
    setIsImportModalOpen(true);
    setImportStep('upload');
    setImportFile(null);
    setImportError(null);
    setParsedRows([]);
    setImportSummary(null);
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportError(null);

    // Validate file type
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setImportError('Invalid file type. Please upload a .csv or .xlsx Excel file.');
      return;
    }

    // Validate size (5MB cap)
    if (file.size > 5 * 1024 * 1024) {
      setImportError('File exceeds maximum size limit of 5MB.');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const rawJson = XLSX.utils.sheet_to_json<any>(workbook.Sheets[sheetName]);

      if (!rawJson || rawJson.length === 0) {
        setImportError('The uploaded file contains no data rows.');
        return;
      }

      if (rawJson.length > 500) {
        setImportError(`File exceeds maximum batch limit of 500 rows (found ${rawJson.length} rows). Please split into smaller files.`);
        return;
      }

      const existingIds = new Set(employees.map(emp => emp.employee_id.toUpperCase()));
      const existingEmails = new Set(employees.map(emp => emp.email ? emp.email.toLowerCase() : ''));
      const fileIds = new Set<string>();
      const fileEmails = new Set<string>();

      const rows: ParsedRow[] = rawJson.map((row: any, idx: number) => {
        const rowNum = idx + 2; // 1-indexed plus header row
        const name = String(row['Name'] ?? row['name'] ?? row['NAME'] ?? '').trim();
        const rawId = String(row['Employee ID'] ?? row['employee id'] ?? row['Employee_ID'] ?? row['id'] ?? row['ID'] ?? '').trim();
        const rawUsername = String(row['Username'] ?? row['username'] ?? row['Email Prefix'] ?? row['email'] ?? '').trim();
        const rawDept = String(row['Department'] ?? row['department'] ?? row['Dept'] ?? '').trim();
        const rawRole = String(row['Role'] ?? row['role'] ?? 'Employee').trim().toLowerCase();

        let isValid = true;
        let errorReason: string | null = null;

        if (!name) {
          isValid = false;
          errorReason = 'Missing Employee Name';
        } else if (!rawId) {
          isValid = false;
          errorReason = 'Missing Employee ID';
        } else {
          const numericId = rawId.replace(/^ECN-/i, '');
          if (!/^\d+$/.test(numericId)) {
            isValid = false;
            errorReason = `Employee ID must be numeric only (found "${rawId}")`;
          } else {
            const formattedId = `ECN-${numericId.toUpperCase()}`;
            if (existingIds.has(formattedId)) {
              isValid = false;
              errorReason = `Duplicate Employee ID "${formattedId}" (already registered in system)`;
            } else if (fileIds.has(formattedId)) {
              isValid = false;
              errorReason = `Duplicate Employee ID "${formattedId}" within this file`;
            } else {
              fileIds.add(formattedId);
            }
          }
        }

        let username = rawUsername;
        if (isValid && !rawUsername) {
          isValid = false;
          errorReason = 'Missing Username';
        } else if (isValid) {
          username = rawUsername.split('@')[0].toLowerCase();
          const formattedEmail = `${username}@dhanuka.com`;
          if (existingEmails.has(formattedEmail)) {
            isValid = false;
            errorReason = `Email username "${formattedEmail}" already exists in system`;
          } else if (fileEmails.has(formattedEmail)) {
            isValid = false;
            errorReason = `Duplicate username "${formattedEmail}" within this file`;
          } else {
            fileEmails.add(formattedEmail);
          }
        }

        let departmentId: string | null = null;
        if (isValid && !rawDept) {
          isValid = false;
          errorReason = 'Missing Department';
        } else if (isValid) {
          const matchedDept = departments.find(d => d.name.toLowerCase() === rawDept.toLowerCase());
          if (!matchedDept) {
            isValid = false;
            errorReason = `Unknown department "${rawDept}" — must match an existing department exactly`;
          } else {
            departmentId = matchedDept.id;
          }
        }

        let role: 'employee' | 'admin' = 'employee';
        if (isValid) {
          if (rawRole === 'admin') {
            role = 'admin';
          } else if (rawRole !== 'employee') {
            isValid = false;
            errorReason = `Invalid role "${row['Role'] ?? rawRole}" (expected Employee or Admin)`;
          }
        }

        return {
          rowNum,
          name,
          numericId: rawId.replace(/^ECN-/i, ''),
          username,
          departmentNameInput: rawDept,
          departmentId,
          role,
          isValid,
          errorReason
        };
      });

      setParsedRows(rows);
      setImportStep('preview');
    } catch (err: any) {
      setImportError(`Failed to parse file: ${err.message}`);
    }
  };

  const handleConfirmImport = () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) return;
    setImportError(null);

    startTransition(async () => {
      const inputs = validRows.map(r => ({
        name: r.name,
        numericId: r.numericId,
        username: r.username,
        departmentId: r.departmentId!,
        role: r.role
      }));
      const res = await bulkImportEmployeesAction(inputs);
      if (res.error) {
        setImportError(res.error);
      } else if (res.success) {
        const skippedRows = parsedRows.filter(r => !r.isValid);
        setImportSummary({
          successCount: res.importedEmployees?.length || 0,
          skippedCount: skippedRows.length,
          importedItems: res.importedEmployees || [],
          skippedItems: skippedRows.map(r => ({
            rowNum: r.rowNum,
            name: r.name,
            numericId: r.numericId,
            username: r.username,
            reason: r.errorReason || 'Skipped'
          }))
        });
        setImportStep('result');
      }
    });
  };

  const handleDownloadResults = async () => {
    if (!importSummary) return;
    try {
      const XLSX = await import('xlsx');
      const importedRows = importSummary.importedItems.map(item => ({
        'Status': 'SUCCESS',
        'Employee ID': item.employee_id,
        'Name': item.name,
        'Email / Username': item.email,
        'Initial Password': item.initial_password,
        'Department': departments.find(d => d.id === item.department_id)?.name || item.department_id,
        'Role': item.role.toUpperCase(),
        'Error / Note': 'Created and ready for login (must reset password on first login)'
      }));
      const skippedRows = importSummary.skippedItems.map(item => ({
        'Status': 'SKIPPED',
        'Employee ID': item.numericId ? `ECN-${item.numericId}` : 'N/A',
        'Name': item.name || 'N/A',
        'Email / Username': item.username ? `${item.username}@dhanuka.com` : 'N/A',
        'Initial Password': 'N/A',
        'Department': 'N/A',
        'Role': 'N/A',
        'Error / Note': item.reason
      }));
      const combined = [...importedRows, ...skippedRows];
      const worksheet = XLSX.utils.json_to_sheet(combined);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Import Results');
      XLSX.writeFile(workbook, `dhanuka_import_results_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err: any) {
      setImportError(`Failed to export results: ${err.message}`);
    }
  };

  const openEditModal = (emp: Employee) => {
    setName(emp.name);
    const emailUser = emp.email ? emp.email.replace(/@.*$/, '') : emp.employee_id.toLowerCase();
    setEmailUsername(emailUser);
    setEmployeeId(emp.employee_id.replace(/^ECN-|^DAL-/i, ''));
    setDepartmentId(emp.department_id || departments[0]?.id || '');
    setRole(emp.role);
    setError(null);
    setSuccessMsg(null);
    setIsCreating(false);
    setEditingEmp(emp);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!name.trim() || !emailUsername.trim() || !employeeId.trim() || !departmentId) {
      setError('Please fill in all required fields.');
      return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', `${emailUsername.trim().toLowerCase()}@dhanuka.com`);
    formData.append('employeeId', `ECN-${employeeId.trim()}`);
    formData.append('departmentId', departmentId);
    formData.append('role', role);

    startTransition(async () => {
      const res = await createEmployeeAction(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccessMsg(res.message || 'Employee created successfully.');
        setTimeout(() => {
          setIsCreating(false);
          setSuccessMsg(null);
        }, 1500);
      }
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;
    setError(null);
    setSuccessMsg(null);

    if (!name.trim() || !emailUsername.trim() || !departmentId) {
      setError('Please fill in all required fields.');
      return;
    }

    const formData = new FormData();
    formData.append('id', editingEmp.id);
    formData.append('name', name);
    formData.append('email', `${emailUsername.trim().toLowerCase()}@dhanuka.com`);
    formData.append('departmentId', departmentId);
    formData.append('role', role);

    startTransition(async () => {
      const res = await updateEmployeeAction(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccessMsg(res.message || 'Employee details updated successfully.');
        setTimeout(() => {
          setEditingEmp(null);
          setSuccessMsg(null);
        }, 1500);
      }
    });
  };

  const handleToggleStatus = (emp: Employee) => {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await toggleEmployeeStatusAction(emp.id, !emp.is_active);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccessMsg(res.message || 'Status updated.');
        if (blockedDeleteEmp?.id === emp.id) {
          setBlockedDeleteEmp(null);
        }
      }
    });
  };

  const handleDeleteClick = (emp: Employee) => {
    setDeletingEmp(emp);
  };

  const handleConfirmDeleteEmp = () => {
    if (!deletingEmp) return;
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await deleteEmployeeAction(deletingEmp.id);
      if (res.error) {
        if (res.error === 'has_bookings') {
          setBlockedMessage(res.message || 'Cannot hard delete an employee with booking history.');
          setBlockedDeleteEmp(deletingEmp);
        } else {
          setError(res.error);
        }
      } else {
        setSuccessMsg(res.message || 'Employee record permanently deleted.');
      }
      setDeletingEmp(null);
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Employee Directory
          </h2>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, ID, dept, email..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={openImportModal}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs flex items-center space-x-2 shadow-sm transition-all active:scale-95 flex-shrink-0"
            title="Bulk Import Employees via CSV or Excel"
          >
            <Upload className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="hidden sm:inline">Import Employees</span>
            <span className="sm:hidden">Import</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-purple-500/20 transition-all active:scale-95 flex-shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Add New Employee</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Global Notifications */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && !isCreating && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center space-x-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Employees Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-4 px-6 w-[28%]">Employee Details</th>
                <th className="py-4 px-6 w-[15%]">Employee ID</th>
                <th className="py-4 px-6 w-[18%]">Department</th>
                <th className="py-4 px-6 w-[15%]">System Role</th>
                <th className="py-4 px-6 w-[12%]">Account Status</th>
                <th className="py-4 px-6 w-[12%] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {(() => {
                const filteredEmployees = sortEmployeesByHierarchy(
                  employees.filter(emp => {
                    if (!debouncedSearch.trim()) return true;
                    const q = debouncedSearch.toLowerCase().trim();
                    const dept = departments.find(d => d.id === emp.department_id);
                    const deptName = dept ? dept.name.toLowerCase() : 'unassigned';
                    return (
                      emp.name.toLowerCase().includes(q) ||
                      emp.employee_id.toLowerCase().includes(q) ||
                      (emp.email && emp.email.toLowerCase().includes(q)) ||
                      deptName.includes(q)
                    );
                  }),
                  departments
                );

                if (filteredEmployees.length === 0) {
                  return (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                            <Search className="w-5 h-5" />
                          </div>
                          <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {searchQuery ? `No employees matching "${searchQuery}"` : 'No employee records found.'}
                          </div>
                          {searchQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchQuery('')}
                              className="text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline mt-1"
                            >
                              Clear search filter
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }

                return filteredEmployees.map((emp) => {
                  const dept = departments.find(d => d.id === emp.department_id);
                  const isEmpAdmin = emp.role === 'admin';
                  const isActive = emp.is_active;
                  const isLocked = emp.is_locked || (emp.failed_login_attempts ?? 0) >= 5;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      {/* Name & Email */}
                      <td className="py-4 px-6 font-bold text-slate-900 dark:text-white flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs flex-shrink-0 ${
                          isEmpAdmin 
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}>
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold">{emp.name}</div>
                          {emp.email && (
                            <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400 font-mono">{emp.email}</div>
                          )}
                        </div>
                      </td>

                      {/* Employee ID Code */}
                      <td className="py-4 px-6 font-mono font-bold text-slate-700 dark:text-slate-300">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                          {emp.employee_id}
                        </span>
                      </td>

                      {/* Department */}
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{dept ? dept.name : 'Unassigned'}</span>
                        </span>
                      </td>

                      {/* Role */}
                      <td className="py-4 px-6">
                        {isEmpAdmin ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-bold text-[11px]">
                            <Shield className="w-3.5 h-3.5 text-purple-600" />
                            <span>Administrator</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-[11px]">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>Employee</span>
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        {!isActive ? (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold text-xs">
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                            <span>Deactivated</span>
                          </span>
                        ) : isLocked ? (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-bold text-xs" title={`Locked after ${emp.failed_login_attempts ?? 5} failed login attempts`}>
                            <span className="text-xs">🔒</span>
                            <span>Locked</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Active</span>
                          </span>
                        )}
                      </td>

                      {/* Actions (Icon-only, compact, center aligned) */}
                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1.5">
                          {/* Edit Button */}
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => openEditModal(emp)}
                            className="p-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 text-purple-600 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80 transition-all active:scale-95 disabled:opacity-50"
                            title="Edit Employee Details"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Reset Password Button */}
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              setResettingEmp(emp);
                              setGeneratedResetUrl(null);
                            }}
                            className="p-2 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/60 text-sky-600 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/80 transition-all active:scale-95 disabled:opacity-50"
                            title="Generate Password Reset Link"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Deactivate / Reactivate Button */}
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleToggleStatus(emp)}
                            className={`p-2 rounded-xl transition-all active:scale-95 disabled:opacity-50 border ${
                              isActive
                                ? 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-600 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/80'
                                : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80'
                            }`}
                            title={isActive ? 'Deactivate Account' : 'Reactivate Account'}
                          >
                            {isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleDeleteClick(emp)}
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/80 transition-all active:scale-95 disabled:opacity-50"
                            title="Permanently Delete Employee"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto shadow-md">
              <UserPlus className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Add New Employee
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Create a new staff record in the Dhanuka GHO directory.
              </p>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name (Required)
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vikram Sharma"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Official Email (Required, Fixed Domain)
                </label>
                <div className="flex rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-purple-500 transition-all">
                  <input
                    type="text"
                    required
                    value={emailUsername}
                    onChange={(e) => setEmailUsername(e.target.value.toLowerCase().replace(/@.*$/, ''))}
                    placeholder="e.g. vikram.sharma"
                    className="w-full px-4 py-2.5 bg-transparent text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                  />
                  <div className="px-3.5 py-2.5 bg-slate-200/70 dark:bg-slate-700/60 border-l border-slate-200 dark:border-slate-700 flex items-center text-slate-600 dark:text-slate-300 font-mono font-bold text-xs select-none whitespace-nowrap">
                    @dhanuka.com
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Employee ID Code (Required, Unique)
                </label>
                <div className="flex rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-purple-500 transition-all">
                  <div className="px-3.5 py-2.5 bg-slate-200/70 dark:bg-slate-700/60 border-r border-slate-200 dark:border-slate-700 flex items-center space-x-1 text-slate-600 dark:text-slate-300 font-mono font-bold text-xs select-none">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>ECN-</span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value.replace(/^ECN-|^DAL-/i, '').replace(/\D/g, ''))}
                    placeholder="e.g. 1025"
                    className="w-full px-4 py-2.5 bg-transparent text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Department
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  System Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'employee' | 'admin')}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="employee">User / Regular Employee</option>
                  <option value="admin">System Administrator</option>
                </select>
              </div>

              {/* Password Notice */}
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 flex items-start space-x-2.5">
                <Key className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Initial Login Credentials</div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                    Default invite password is automatically generated as <strong className="font-mono font-bold bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded text-amber-900 dark:text-amber-200">{getDynamicPassword()}</strong> (first 4 letters of username + numeric employee code). The employee can log in using <strong className="font-mono">ECN-{employeeId || 'XXXX'}</strong> and this initial password.
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Create Employee</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editingEmp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
            <button
              type="button"
              onClick={() => setEditingEmp(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto shadow-md">
              <Edit3 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Edit Employee Details
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Update profile information and system access level for <strong className="font-bold text-slate-800 dark:text-slate-200">{editingEmp.name}</strong>.
              </p>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name (Required)
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vikram Sharma"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Official Email (Required, Fixed Domain)
                </label>
                <div className="flex rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-purple-500 transition-all">
                  <input
                    type="text"
                    required
                    value={emailUsername}
                    onChange={(e) => setEmailUsername(e.target.value.toLowerCase().replace(/@.*$/, ''))}
                    placeholder="e.g. vikram.sharma"
                    className="w-full px-4 py-2.5 bg-transparent text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                  />
                  <div className="px-3.5 py-2.5 bg-slate-200/70 dark:bg-slate-700/60 border-l border-slate-200 dark:border-slate-700 flex items-center text-slate-600 dark:text-slate-300 font-mono font-bold text-xs select-none whitespace-nowrap">
                    @dhanuka.com
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Employee ID Code (Locked)
                  </label>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                    Non-Editable
                  </span>
                </div>
                <div className="flex rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 overflow-hidden opacity-80 cursor-not-allowed" title="Employee ID is a stable identifier and cannot be changed after creation.">
                  <div className="px-3.5 py-2.5 bg-slate-200/70 dark:bg-slate-700/60 border-r border-slate-200 dark:border-slate-700 flex items-center space-x-1 text-slate-500 dark:text-slate-400 font-mono font-bold text-xs select-none">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>ECN-</span>
                  </div>
                  <input
                    type="text"
                    disabled
                    value={employeeId}
                    className="w-full px-4 py-2.5 bg-transparent text-xs font-mono font-bold text-slate-600 dark:text-slate-400 focus:outline-none cursor-not-allowed"
                  />
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  Employee ID is used as a permanent system reference and cannot be modified.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Department
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  System Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'employee' | 'admin')}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="employee">User / Regular Employee</option>
                  <option value="admin">System Administrator</option>
                </select>
                <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 font-medium">
                  {role === 'admin' 
                    ? '⚠️ Granting Administrator status provides full app-wide control and immediate access.'
                    : 'Regular employee access is restricted to personal bookings and room reservations.'}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingEmp(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Employee Deletion Modal */}
      {deletingEmp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-rose-900/60 p-6 space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-md">
              <Trash2 className="w-6 h-6" />
            </div>

            {(() => {
              const empBookingsCount = bookings ? bookings.filter(b => b.employee_id === deletingEmp.id).length : 0;
              const hasBookings = empBookingsCount > 0;

              return (
                <>
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                      Delete Employee Record
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Are you sure you want to delete employee <strong className="font-bold text-slate-900 dark:text-white">{deletingEmp.name} ({deletingEmp.employee_id})</strong>? This action cannot be undone.
                    </p>
                    {hasBookings && (
                      <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-left text-xs text-amber-800 dark:text-amber-300 mt-3 space-y-1">
                        <div className="font-bold flex items-center space-x-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Deletion Blocked: Booking History</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          This employee has <strong className="font-extrabold">{empBookingsCount} booking(s)</strong> in the system. Hard deletion is blocked to preserve audit logs and reporting integrity. Please deactivate their account instead.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setDeletingEmp(null)}
                      className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
                    >
                      Cancel
                    </button>
                    {hasBookings ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          handleToggleStatus(deletingEmp);
                          setDeletingEmp(null);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-amber-500/20 transition-all"
                      >
                        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>Deactivate Account Instead</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={handleConfirmDeleteEmp}
                        className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-rose-500/20 transition-all"
                      >
                        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>Confirm Delete</span>
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Blocked Hard Delete Modal */}
      {blockedDeleteEmp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-rose-900/60 p-6 space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-md">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Cannot Hard Delete Record
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {blockedMessage}
              </p>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-left text-xs text-slate-500 dark:text-slate-400 mt-2">
                <span className="font-bold text-slate-700 dark:text-slate-200">Historical Integrity Policy:</span> Employee records associated with past meetings or audit logs cannot be purged from the database. Soft-deleting (deactivating) prevents login and new reservations while preserving reports.
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setBlockedDeleteEmp(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleToggleStatus(blockedDeleteEmp)}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-amber-500/20 transition-all"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Deactivate Account Instead</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Password Reset Confirmation Modal */}
      {resettingEmp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
            <button
              type="button"
              onClick={() => setResettingEmp(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto shadow-md">
              <KeyRound className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Send Password Reset?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                You are about to generate a one-time password reset link for <span className="font-bold text-slate-900 dark:text-white">{resettingEmp.name}</span> ({resettingEmp.employee_id}).
              </p>
              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 text-left text-xs text-sky-800 dark:text-sky-300 mt-3 space-y-1">
                <p className="font-bold">What happens next:</p>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>Any existing account lockout will be removed immediately.</li>
                  <li>A secure one-time link (valid for 24 hours) will be generated.</li>
                  <li>You will be shown the link to copy and send to the employee.</li>
                  <li>The employee must set a new password before accessing their dashboard.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setResettingEmp(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmResetPassword}
                className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-sky-500/20 transition-all"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Generate Reset Link</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generated One-Time Reset Link Modal */}
      {generatedResetUrl && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-emerald-200 dark:border-emerald-900/60 p-6 space-y-6">
            <button
              type="button"
              onClick={() => setGeneratedResetUrl(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-md">
              <Link2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Password Reset Link Generated
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                For <span className="font-bold text-emerald-600 dark:text-emerald-400">{generatedResetUrl.empName}</span>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  One-Time Reset URL
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Valid for 24 Hours
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={generatedResetUrl.url}
                  className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopyUrl(generatedResetUrl.url)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shrink-0 ${
                    copiedUrl
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white'
                  }`}
                >
                  {copiedUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Security Notice:</strong> This link can only be used once. Share it with the employee directly via email or secure message. Once used, it will be immediately invalidated.
              </span>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setGeneratedResetUrl(null)}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white font-bold text-xs transition-all shadow-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BULK IMPORT MODAL ────────────────────────────────────────────── */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-4xl w-full shadow-2xl max-h-[90vh] flex flex-col relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-300">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {importStep === 'upload' && 'Bulk Import Employees'}
                    {importStep === 'preview' && 'Review & Validate Data Preview'}
                    {importStep === 'result' && 'Import Results Summary'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {importStep === 'upload' && 'Upload a CSV or Excel (.xlsx) file to create multiple employee records simultaneously.'}
                    {importStep === 'preview' && 'Review highlighted rows below before committing the import.'}
                    {importStep === 'result' && 'Batch processing completed. Download the summary report with initial passwords.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error banner inside modal */}
            {importError && (
              <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{importError}</span>
                </div>
                <button type="button" onClick={() => setImportError(null)} className="text-rose-500 hover:text-rose-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Step 1: Upload */}
            {importStep === 'upload' && (
              <div className="space-y-6 flex-1 overflow-y-auto pr-1">
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center hover:border-purple-400 dark:hover:border-purple-600 transition-colors bg-slate-50/50 dark:bg-slate-800/20 flex flex-col items-center justify-center relative">
                  <div className="w-16 h-16 rounded-3xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-md flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                    Select or Drop your spreadsheet here
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 max-w-md">
                    Accepts `.csv`, `.xlsx`, or `.xls` files up to 5MB (maximum 500 rows per batch).
                  </p>
                  <label className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-lg shadow-purple-500/20 cursor-pointer transition-all active:scale-95">
                    <span>Browse File</span>
                    <input
                      type="file"
                      accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Expected Columns Box */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Expected Columns & Rules
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-purple-600 dark:text-purple-400 block mb-0.5">Name</span>
                      <span className="text-slate-600 dark:text-slate-400">Full name of the employee (Required).</span>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-purple-600 dark:text-purple-400 block mb-0.5">Employee ID</span>
                      <span className="text-slate-600 dark:text-slate-400">Numeric part only (e.g., `1025`). System prepends `ECN-`.</span>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-purple-600 dark:text-purple-400 block mb-0.5">Username</span>
                      <span className="text-slate-600 dark:text-slate-400">Email prefix (e.g., `johndoe`). System appends `@dhanuka.com`.</span>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-purple-600 dark:text-purple-400 block mb-0.5">Department</span>
                      <span className="text-slate-600 dark:text-slate-400">Must exactly match an existing department name (case-insensitive).</span>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 md:col-span-2">
                      <span className="font-bold text-purple-600 dark:text-purple-400 block mb-0.5">Role</span>
                      <span className="text-slate-600 dark:text-slate-400">`Employee` (default) or `Admin`. Must be unique ID & Email.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Preview Table */}
            {importStep === 'preview' && (
              <div className="flex flex-col flex-1 overflow-hidden space-y-4">
                
                {/* Stats Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl shrink-0">
                  <div className="flex items-center space-x-4 text-xs font-bold">
                    <span className="text-slate-700 dark:text-slate-300">Total Rows: <span className="text-purple-600 dark:text-purple-400">{parsedRows.length}</span></span>
                    <span className="text-emerald-700 dark:text-emerald-400 flex items-center">
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Valid: {parsedRows.filter(r => r.isValid).length}
                    </span>
                    {parsedRows.filter(r => !r.isValid).length > 0 && (
                      <span className="text-rose-700 dark:text-rose-400 flex items-center">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                        Flagged Errors: {parsedRows.filter(r => !r.isValid).length}
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    File: <strong>{importFile?.name}</strong>
                  </span>
                </div>

                {/* Table Container */}
                <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 font-extrabold text-slate-600 dark:text-slate-300 sticky top-0 z-10">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-4">Name</th>
                        <th className="py-2.5 px-4">ID (ECN-)</th>
                        <th className="py-2.5 px-4">Username (@dhanuka)</th>
                        <th className="py-2.5 px-4">Department</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-4">Validation Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {parsedRows.map(row => (
                        <tr
                          key={row.rowNum}
                          className={row.isValid
                            ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors'
                            : 'bg-rose-50/80 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 hover:bg-rose-100/80 dark:hover:bg-rose-950/50 transition-colors'
                          }
                        >
                          <td className="py-2.5 px-3 font-mono text-slate-400">{row.rowNum}</td>
                          <td className="py-2.5 px-4 font-bold">{row.name || <span className="italic text-slate-400">Missing</span>}</td>
                          <td className="py-2.5 px-4 font-mono">{row.numericId ? `ECN-${row.numericId}` : <span className="italic text-slate-400">Missing</span>}</td>
                          <td className="py-2.5 px-4 font-mono">{row.username ? `${row.username}@dhanuka.com` : <span className="italic text-slate-400">Missing</span>}</td>
                          <td className="py-2.5 px-4">{row.departmentNameInput || <span className="italic text-slate-400">Missing</span>}</td>
                          <td className="py-2.5 px-3 capitalize">{row.role}</td>
                          <td className="py-2.5 px-4">
                            {row.isValid ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">
                                <Check className="w-3 h-3" />
                                <span>Ready</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 font-bold text-[11px]">
                                <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                                <span>{row.errorReason}</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setImportStep('upload');
                      setImportFile(null);
                      setParsedRows([]);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all"
                  >
                    Cancel / Re-upload
                  </button>

                  <button
                    type="button"
                    disabled={isPending || parsedRows.filter(r => r.isValid).length === 0}
                    onClick={handleConfirmImport}
                    className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-purple-500/20 flex items-center space-x-2 transition-all active:scale-95"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Processing Batch...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Import Valid Rows ({parsedRows.filter(r => r.isValid).length})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Result Summary */}
            {importStep === 'result' && importSummary && (
              <div className="space-y-6 flex-1 overflow-y-auto pr-1">
                <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-slate-100 dark:border-slate-800">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">
                    {importSummary.successCount} employees imported successfully
                  </h4>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {importSummary.skippedCount > 0
                      ? `${importSummary.skippedCount} rows were skipped due to validation errors.`
                      : 'All validated records were created and assigned initial passwords.'}
                  </p>
                </div>

                {/* Skipped Errors list if any */}
                {importSummary.skippedCount > 0 && (
                  <div className="bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 space-y-2">
                    <h5 className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-1.5" />
                      Skipped Rows Summary ({importSummary.skippedCount})
                    </h5>
                    <div className="max-h-36 overflow-y-auto space-y-1 text-xs text-rose-700 dark:text-rose-300 font-medium">
                      {importSummary.skippedItems.map((item, i) => (
                        <div key={i} className="flex items-center justify-between py-1 border-b border-rose-100 dark:border-rose-900/40 last:border-0">
                          <span>Row #{item.rowNum}: <strong>{item.name || item.username || `ID ${item.numericId}`}</strong></span>
                          <span className="font-bold text-[11px] bg-rose-100 dark:bg-rose-900 px-2 py-0.5 rounded-md">{item.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-8 h-8 text-purple-600 dark:text-purple-400 shrink-0" />
                    <div>
                      <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                        Download Initial Password & Results File
                      </h5>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Contains generated IDs (`ECN-XXXX`) and initial passwords required for employee onboarding.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadResults}
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md flex items-center space-x-2 transition-all active:scale-95 whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Summary (.xlsx)</span>
                  </button>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className="px-8 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white font-bold text-xs transition-all shadow-lg"
                  >
                    Close & Finish
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
