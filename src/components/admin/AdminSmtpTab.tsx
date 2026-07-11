'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  Mail,
  Server,
  ShieldCheck,
  Eye,
  EyeOff,
  Save,
  Trash2,
  Send,
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
  History,
  XCircle
} from 'lucide-react';
import {
  getSmtpSettingsAction,
  saveSmtpSettingsAction,
  clearSmtpSettingsAction,
  sendTestEmailAction
} from '@/actions/smtp';
import { SmtpSettings, EmailLogEntry } from '@/lib/types';
import { getStoreEmailLogs } from '@/lib/mock-store';

export default function AdminSmtpTab() {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SmtpSettings & { password_placeholder?: string }>({
    server_address: '',
    port: 587,
    username: '',
    password_required: true,
    sender_email: 'notifications@dhanuka.com',
    sender_name: 'Dhanuka Meeting Room System',
    is_configured: false,
    password_placeholder: '',
  });

  const [customPort, setCustomPort] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  
  // Test Email state
  const [testEmail, setTestEmail] = useState('');
  const [testStatus, setTestStatus] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Clear confirmation modal state
  const [showClearModal, setShowClearModal] = useState(false);

  // Feedback message
  const [feedback, setFeedback] = useState<{ success?: boolean; text: string } | null>(null);

  // Email delivery logs (Phase 4 reviewable log)
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [activeView, setActiveView] = useState<'config' | 'logs'>('config');

  useEffect(() => {
    loadSettings();
    loadLogs();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await getSmtpSettingsAction();
      if (res.success && res.settings) {
        setSettings(res.settings);
        const p = res.settings.port;
        if (![25, 465, 587].includes(p)) {
          setCustomPort(true);
        } else {
          setCustomPort(false);
        }
        if (res.settings.password_placeholder) {
          setPasswordInput('••••••••');
        }
      }
    } catch (err) {
      console.error('Failed to load SMTP settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = () => {
    try {
      // In a real environment, this can be fetched via server action
      const storeLogs = getStoreEmailLogs();
      setLogs([...storeLogs]);
    } catch (err) {
      console.error('Failed to load email logs:', err);
    }
  };

  const handlePortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'custom') {
      setCustomPort(true);
    } else {
      setCustomPort(false);
      setSettings((prev) => ({ ...prev, port: parseInt(val, 10) }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const formData = new FormData();
    formData.append('server_address', settings.server_address);
    formData.append('port', settings.port.toString());
    formData.append('username', settings.username);
    formData.append('password', passwordInput);
    formData.append('password_required', settings.password_required.toString());
    formData.append('sender_email', settings.sender_email);
    formData.append('sender_name', settings.sender_name);

    startTransition(async () => {
      const res = await saveSmtpSettingsAction(formData);
      if (res.error) {
        setFeedback({ success: false, text: res.error });
      } else if (res.success) {
        setFeedback({ success: true, text: res.message || 'SMTP settings saved successfully.' });
        await loadSettings();
      }
    });
  };

  const handleClearConfirm = async () => {
    setShowClearModal(false);
    setFeedback(null);
    startTransition(async () => {
      const res = await clearSmtpSettingsAction();
      if (res.error) {
        setFeedback({ success: false, text: res.error });
      } else {
        setFeedback({ success: true, text: res.message || 'SMTP settings cleared.' });
        setPasswordInput('');
        await loadSettings();
      }
    });
  };

  const handleSendTest = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      setTestStatus({ success: false, error: 'Please enter a valid recipient email address for the test.' });
      return;
    }

    setTesting(true);
    setTestStatus(null);
    try {
      const res = await sendTestEmailAction(testEmail, {
        server_address: settings.server_address,
        port: settings.port,
        username: settings.username,
        password: passwordInput,
        password_required: settings.password_required,
        sender_email: settings.sender_email,
        sender_name: settings.sender_name,
      });

      if (res.error) {
        setTestStatus({ success: false, error: res.error });
      } else {
        setTestStatus({ success: true, message: res.message });
      }
      loadLogs();
    } catch (err: any) {
      setTestStatus({ success: false, error: err.message || 'Failed to send test email.' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-3" />
        <span>Loading SMTP Email Configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Sub-nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
            <Mail className="w-5 h-5 mr-2.5 text-emerald-600 dark:text-emerald-400" />
            SMTP Email Notification Gateway
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure secure SMTP outbound relay settings for automated meeting portal email notifications.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => { setActiveView('config'); setFeedback(null); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeView === 'config'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Email Settings</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveView('logs'); loadLogs(); setFeedback(null); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeView === 'logs'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Delivery Logs ({logs.length})</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm font-medium border ${
            feedback.success
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.success ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs opacity-70 hover:opacity-100 font-bold ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* VIEW: Configuration Form */}
      {activeView === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main SMTP Form (2 cols) */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <form onSubmit={handleSave} className="space-y-6">
              
              {/* Security Banner */}
              <div className="flex items-start space-x-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs text-slate-600 dark:text-slate-300">
                <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">Secure Server-Side Encryption (AES-256-GCM)</span>
                  <p className="mt-0.5">
                    All sensitive SMTP passwords are encrypted at rest on the backend. Stored passwords are never decrypted or transmitted back to any frontend interface after saving.
                  </p>
                </div>
              </div>

              {/* Server & Port Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    SMTP Server Address *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., smtp.office365.com or smtp.gmail.com"
                    value={settings.server_address}
                    onChange={(e) => setSettings({ ...settings, server_address: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    SMTP Port *
                  </label>
                  {!customPort ? (
                    <select
                      value={settings.port}
                      onChange={handlePortChange}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all font-semibold"
                    >
                      <option value={587}>587 (TLS / STARTTLS)</option>
                      <option value={465}>465 (SSL Direct)</option>
                      <option value={25}>25 (Standard / Relay)</option>
                      <option value="custom">Custom Port...</option>
                    </select>
                  ) : (
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="number"
                        required
                        value={settings.port}
                        onChange={(e) => setSettings({ ...settings, port: parseInt(e.target.value, 10) || 0 })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => { setCustomPort(false); setSettings({ ...settings, port: 587 }); }}
                        className="px-2.5 py-2.5 text-xs font-bold bg-slate-200 dark:bg-slate-700 rounded-xl hover:bg-slate-300 text-slate-700 dark:text-slate-300"
                        title="Reset to preset"
                      >
                        Preset
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Authentication Required Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white block">
                    Password Authentication Required
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    If enabled, the gateway will authenticate via SMTP username and encrypted password.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                  <input
                    type="checkbox"
                    checked={settings.password_required}
                    onChange={(e) => setSettings({ ...settings, password_required: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Credentials Fields (Only shown if authentication is required) */}
              {settings.password_required && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 transition-all">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      SMTP Username *
                    </label>
                    <input
                      type="text"
                      required={settings.password_required}
                      placeholder="e.g., notifications@dhanuka.com"
                      value={settings.username}
                      onChange={(e) => setSettings({ ...settings, username: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      SMTP Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required={settings.password_required && !settings.password_placeholder}
                        placeholder={settings.password_placeholder || 'Enter SMTP password'}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Sender Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Sender Email Address (From) *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g., notifications@dhanuka.com"
                    value={settings.sender_email}
                    onChange={(e) => setSettings({ ...settings, sender_email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all font-mono"
                  />
                  <span className="text-[11px] text-slate-500 block mt-1">
                    Address employees will see emails coming from.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Sender Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Dhanuka Meeting Room System"
                    value={settings.sender_name}
                    onChange={(e) => setSettings({ ...settings, sender_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all font-medium"
                  />
                  <span className="text-[11px] text-slate-500 block mt-1">
                    Friendly name shown in employee inboxes.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold flex items-center space-x-2 shadow-md shadow-emerald-600/25 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isPending ? 'Saving & Encrypting...' : 'Save Settings'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowClearModal(true)}
                    className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 text-sm font-bold flex items-center space-x-1.5 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear Existing Settings</span>
                  </button>
                </div>

                {settings.is_configured && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Active Gateway Configuration
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* Side Panel: Send Verification Test Email */}
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center mb-2">
                <Send className="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400" />
                Send Test Email
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Test your SMTP configuration right now before relying on it for employee notifications. You can test form values even before clicking save.
              </p>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Recipient Test Email
                </label>
                <input
                  type="email"
                  placeholder="admin@dhanuka.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />

                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={testing || !settings.server_address}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center space-x-2 transition-all shadow-sm mt-2"
                >
                  {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{testing ? 'Verifying & Sending...' : 'Send Test Email Now'}</span>
                </button>
              </div>

              {testStatus && (
                <div
                  className={`mt-4 p-3.5 rounded-xl text-xs font-medium border ${
                    testStatus.success
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    {testStatus.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="break-all">
                      <span className="font-bold block mb-0.5">
                        {testStatus.success ? 'Delivery Confirmed' : 'SMTP Relay Error'}
                      </span>
                      {testStatus.message || testStatus.error}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500">
              <span className="font-bold block text-slate-600 dark:text-slate-400 mb-1">
                Automated Event Triggers Enabled:
              </span>
              <ul className="list-disc list-inside space-y-1">
                <li>New employee account created</li>
                <li>Admin password reset link delivery</li>
                <li>Booking confirmation to organizer & invitees</li>
                <li>Booking cancellation notice</li>
                <li>Security alert on 5 failed attempts</li>
                <li>Bulk import completion summary</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: Delivery Logs */}
      {activeView === 'logs' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Outbound Email Delivery History
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Review automated email notifications sent across the Dhanuka portal. Failures are logged without blocking application workflows.
              </p>
            </div>
            <button
              onClick={loadLogs}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 text-xs font-bold flex items-center space-x-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Logs</span>
            </button>
          </div>

          {logs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <Mail className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
              <p className="font-semibold text-sm">No email notifications recorded yet.</p>
              <p className="text-xs mt-1">Once SMTP is configured, verification tests and portal triggers will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Event Trigger</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Error / Details</th>
                    <th className="py-3 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        {log.status === 'sent' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Sent
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                            <XCircle className="w-3 h-3 mr-1" />
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-purple-600 dark:text-purple-400 font-bold">
                        {log.event_type}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-900 dark:text-slate-200">
                        {log.recipient}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-300">
                        {log.subject}
                      </td>
                      <td className="py-3 px-4 text-xs text-rose-600 dark:text-rose-400 font-mono">
                        {log.error_message || '—'}
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-slate-400 font-mono">
                        {new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog: Clear Settings */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Clear SMTP Settings?</h3>
                <span className="text-xs text-slate-500">This action will immediately disable outbound emails.</span>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to clear all existing SMTP gateway credentials? This will break automated email notifications (such as booking confirmations and password resets) until reconfigured.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={handleClearConfirm}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 transition-all"
              >
                {isPending ? 'Clearing...' : 'Yes, Clear Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
