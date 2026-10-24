import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Settings,
  UserPlus,
  KeyRound,
  UserCheck,
  UserX,
  ShieldCheck,
  Loader2,
  Info,
  Calendar,
  MapPin,
  FileText,
  Target,
  Receipt,
  CreditCard,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Modal } from '../components/common/Modal';
import { usersService, settingsService } from '../services';
import { formatDate, getErrorMessage, rupeesToPaise } from '../utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function Avatar({ name, size = 'md' }) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-9 h-9 text-sm',
  };
  return (
    <div
      className={`${sizes[size]} rounded-full bg-forest-100 text-forest-700 font-semibold flex items-center justify-center flex-shrink-0`}
    >
      {getInitials(name)}
    </div>
  );
}

function Badge({ children, variant }) {
  const variants = {
    admin:    'bg-forest-100 text-forest-700',
    volunteer:'bg-sand-100 text-sand-700',
    active:   'bg-emerald-100 text-emerald-700',
    inactive: 'bg-red-100 text-red-600',
    you:      'bg-blue-100 text-blue-700',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        variants[variant] || 'bg-gray-100 text-gray-600'
      }`}
    >
      {children}
    </span>
  );
}

function PasswordField({ label, value, onChange, placeholder, hint }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-400 focus:border-transparent"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add User Modal
// ---------------------------------------------------------------------------

function AddUserModal({ isOpen, onClose, onSuccess }) {
  const { error: notifyError, success: notifySuccess } = useNotification();
  const [form, setForm] = useState({
    name: '',
    username: '',
    role: 'volunteer',
    password: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState(false);

  const reset = () =>
    setForm({ name: '', username: '', role: 'volunteer', password: '', confirmPassword: '' });

  const handleClose = () => {
    reset();
    onClose();
  };

  const set = (field) => (e) => {
    let val = e.target.value;
    if (field === 'username') val = val.toLowerCase().replace(/\s+/g, '');
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return notifyError('Full name is required.');
    if (!form.username.trim()) return notifyError('Username is required.');
    if (form.password.length < 8) return notifyError('Password must be at least 8 characters.');
    if (form.password !== form.confirmPassword) return notifyError('Passwords do not match.');

    setSaving(true);
    try {
      await usersService.create({
        name: form.name.trim(),
        username: form.username.trim(),
        role: form.role,
        password: form.password,
      });
      notifySuccess(`Team member "${form.name.trim()}" added successfully.`);
      reset();
      onSuccess();
    } catch (err) {
      notifyError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Team Member"
      size="md"
      footer={
        <>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-forest-600 hover:bg-forest-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Adding…' : 'Add Member'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Full Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={set('name')}
            placeholder="e.g. John Doe"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-400 focus:border-transparent"
          />
        </div>

        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Username <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.username}
            onChange={set('username')}
            placeholder="e.g. johndoe"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-400 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">Lowercase letters and numbers only, no spaces.</p>
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            value={form.role}
            onChange={set('role')}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-400 focus:border-transparent bg-white"
          >
            <option value="volunteer">Volunteer</option>
            <option value="admin">Admin</option>
          </select>
          <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Role cannot be changed after creation.
          </p>
        </div>

        {/* Password */}
        <PasswordField
          label={<>Password <span className="text-red-500">*</span></>}
          value={form.password}
          onChange={set('password')}
          placeholder="Minimum 8 characters"
          hint="Must be at least 8 characters."
        />

        {/* Confirm Password */}
        <PasswordField
          label={<>Confirm Password <span className="text-red-500">*</span></>}
          value={form.confirmPassword}
          onChange={set('confirmPassword')}
          placeholder="Re-enter password"
        />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Reset Password Modal
// ---------------------------------------------------------------------------

function ResetPasswordModal({ isOpen, onClose, targetUser }) {
  const { error: notifyError, success: notifySuccess } = useNotification();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    setPassword('');
    setConfirm('');
    onClose();
  };

  const handleSubmit = async () => {
    if (password.length < 8) return notifyError('Password must be at least 8 characters.');
    if (password !== confirm) return notifyError('Passwords do not match.');

    setSaving(true);
    try {
      await usersService.update(targetUser.id, { password });
      notifySuccess(`Password reset for ${targetUser.name}.`);
      handleClose();
    } catch (err) {
      notifyError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Reset Password — ${targetUser?.name ?? ''}`}
      size="sm"
      footer={
        <>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-forest-600 hover:bg-forest-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : 'Reset Password'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <PasswordField
          label="New Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimum 8 characters"
          hint="Must be at least 8 characters."
        />
        <PasswordField
          label="Confirm New Password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter new password"
        />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Tab 1 — Team Members
// ---------------------------------------------------------------------------

function TeamMembersTab() {
  const { user: currentUser, isAdmin } = useAuth();
  const { error: notifyError, success: notifySuccess } = useNotification();

  const [users, setUsers]                   = useState([]);
  const [loading, setLoading]               = useState(true);
  const [showAddModal, setShowAddModal]     = useState(false);
  const [resetTarget, setResetTarget]       = useState(null);
  const [togglingId, setTogglingId]         = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersService.getAll();
      setUsers(res.data.users ?? res.data);
    } catch (err) {
      notifyError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleToggleStatus = async (u) => {
    // Admins cannot deactivate themselves
    if (u.id === currentUser?.id) return;
    const nextStatus = u.status === 'active' ? 'inactive' : 'active';
    setTogglingId(u.id);
    try {
      await usersService.update(u.id, { status: nextStatus });
      notifySuccess(
        nextStatus === 'active'
          ? `${u.name} has been reactivated.`
          : `${u.name} has been deactivated.`
      );
      fetchUsers();
    } catch (err) {
      notifyError(getErrorMessage(err));
    } finally {
      setTogglingId(null);
    }
  };

  const isSelf = (u) => u.id === currentUser?.id;

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage volunteer and admin accounts for your event.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-forest-600 hover:bg-forest-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add Member
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-forest-500" />
        </div>
      )}

      {/* Empty state */}
      {!loading && users.length === 0 && (
        <div className="text-center py-20">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No team members yet.</p>
          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 text-sm text-forest-600 hover:underline"
            >
              Add your first member →
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {!loading && users.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-card">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-10" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Username
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Created
                </th>
                {isAdmin && (
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-sand-50 transition-colors">
                  {/* Avatar */}
                  <td className="px-4 py-3">
                    <Avatar name={u.name} />
                  </td>

                  {/* Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{u.name}</span>
                      {isSelf(u) && <Badge variant="you">You</Badge>}
                    </div>
                  </td>

                  {/* Username */}
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">@{u.username}</td>

                  {/* Role */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={u.role}>
                        {u.role === 'admin' ? (
                          <><ShieldCheck className="w-3 h-3" /> Admin</>
                        ) : (
                          'Volunteer'
                        )}
                      </Badge>
                      <span
                        title="Role cannot be changed after creation."
                        className="text-gray-300 hover:text-gray-500 cursor-help"
                      >
                        <Info className="w-3 h-3" />
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <Badge variant={u.status === 'active' ? 'active' : 'inactive'}>
                      {u.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>

                  {/* Created At */}
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(u.created_at)}</td>

                  {/* Actions */}
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Reset Password */}
                        <button
                          onClick={() => setResetTarget(u)}
                          title="Reset password"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          Reset PW
                        </button>

                        {/* Activate / Deactivate */}
                        {isSelf(u) ? (
                          <span
                            title="You cannot deactivate your own account."
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-50 rounded-lg cursor-not-allowed"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            Deactivate
                          </span>
                        ) : u.status === 'active' ? (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={togglingId === u.id}
                            title="Deactivate this user"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-60"
                          >
                            {togglingId === u.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserX className="w-3.5 h-3.5" />
                            )}
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={togglingId === u.id}
                            title="Reactivate this user"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-60"
                          >
                            {togglingId === u.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <AddUserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => { setShowAddModal(false); fetchUsers(); }}
      />
      <ResetPasswordModal
        isOpen={!!resetTarget}
        onClose={() => setResetTarget(null)}
        targetUser={resetTarget}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2 — Event Settings
// ---------------------------------------------------------------------------

const SETTINGS_DEFAULTS = {
  event_name: '',
  event_date: '',
  location: '',
  description: '',
  daily_sales_target: '',    // rupees in UI
  target_units_per_day: '',
  org_name: '',
  receipt_header: '',
  receipt_footer: '',
  contact_info: '',
  enable_cash: true,
  enable_upi: true,
  enable_other: false,
  upi_id: '',
};

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="flex-shrink-0 w-8 h-8 bg-forest-100 rounded-lg flex items-center justify-center mt-0.5">
        <Icon className="w-4 h-4 text-forest-600" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

function FormGroup({ label, required, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', ...rest }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-400 focus:border-transparent"
      {...rest}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-400 focus:border-transparent resize-none"
    />
  );
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5 flex-shrink-0">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={onChange}
        />
        <div
          className={`w-10 h-5 rounded-full transition-colors ${
            checked ? 'bg-forest-600' : 'bg-gray-200'
          }`}
        />
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
      <div>
        <span className="text-sm font-medium text-gray-800">{label}</span>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
    </label>
  );
}

function EventSettingsTab() {
  const { error: notifyError, success: notifySuccess } = useNotification();
  const [form, setForm]     = useState(SETTINGS_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  // Load settings on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await settingsService.get();
        const s   = res.data.settings ?? res.data ?? {};
        setForm({
          event_name:          s.event_name          ?? '',
          event_date:          s.event_date          ? s.event_date.split('T')[0] : '',
          location:            s.location            ?? '',
          description:         s.description         ?? '',
          daily_sales_target:  s.daily_sales_target != null
                                 ? String(s.daily_sales_target / 100)   // paise → rupees
                                 : '',
          target_units_per_day: s.target_units_per_day != null
                                 ? String(s.target_units_per_day)
                                 : '',
          org_name:            s.org_name            ?? '',
          receipt_header:      s.receipt_header      ?? '',
          receipt_footer:      s.receipt_footer      ?? '',
          contact_info:        s.contact_info        ?? '',
          enable_cash:         s.enable_cash  ?? true,
          enable_upi:          s.enable_upi   ?? true,
          enable_other:        s.enable_other ?? false,
          upi_id:              s.upi_id       ?? '',
        });
      } catch (err) {
        notifyError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [notifyError]);

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const setCheck = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.checked }));

  const handleSave = async () => {
    if (!form.event_name.trim()) return notifyError('Event name is required.');

    setSaving(true);
    try {
      const payload = {
        event_name:           form.event_name.trim(),
        event_date:           form.event_date || null,
        location:             form.location.trim() || null,
        description:          form.description.trim() || null,
        daily_sales_target:   form.daily_sales_target !== ''
                                ? rupeesToPaise(form.daily_sales_target)
                                : null,
        target_units_per_day: form.target_units_per_day !== ''
                                ? Number(form.target_units_per_day)
                                : null,
        org_name:             form.org_name.trim() || null,
        receipt_header:       form.receipt_header.trim() || null,
        receipt_footer:       form.receipt_footer.trim() || null,
        contact_info:         form.contact_info.trim() || null,
        enable_cash:          form.enable_cash,
        enable_upi:           form.enable_upi,
        enable_other:         form.enable_other,
        upi_id:               form.enable_upi ? (form.upi_id.trim() || null) : null,
      };
      await settingsService.update(payload);
      notifySuccess('Settings saved successfully.');
    } catch (err) {
      notifyError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-forest-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Event Settings</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure event details, sales targets, and receipt branding.
        </p>
      </div>

      {/* ── Event Details ─────────────────────────────────── */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-card p-6">
        <SectionHeader
          icon={Calendar}
          title="Event Details"
          description="Basic information about your sale event."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FormGroup label="Event Name" required>
              <TextInput
                value={form.event_name}
                onChange={set('event_name')}
                placeholder="e.g. Mission Sunday 2026"
              />
            </FormGroup>
          </div>
          <FormGroup label="Event Date">
            <TextInput type="date" value={form.event_date} onChange={set('event_date')} />
          </FormGroup>
          <FormGroup label="Location / Venue">
            <TextInput
              value={form.location}
              onChange={set('location')}
              placeholder="e.g. Main Hall, St. Mary's Church"
            />
          </FormGroup>
          <div className="sm:col-span-2">
            <FormGroup label="Description / Notes">
              <TextArea
                value={form.description}
                onChange={set('description')}
                placeholder="Any notes about this event…"
              />
            </FormGroup>
          </div>
        </div>
      </section>

      {/* ── Sales Targets ─────────────────────────────────── */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-card p-6">
        <SectionHeader
          icon={Target}
          title="Sales Targets"
          description="Set daily revenue and unit goals for your team."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormGroup
            label="Daily Sales Target (₹)"
            hint="Enter amount in rupees. Stored internally as paise."
          >
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.daily_sales_target}
                onChange={set('daily_sales_target')}
                placeholder="0"
                className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest-400 focus:border-transparent"
              />
            </div>
          </FormGroup>
          <FormGroup label="Target Units per Day">
            <TextInput
              type="number"
              min="0"
              step="1"
              value={form.target_units_per_day}
              onChange={set('target_units_per_day')}
              placeholder="0"
            />
          </FormGroup>
        </div>
      </section>

      {/* ── Receipt Branding ──────────────────────────────── */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-card p-6">
        <SectionHeader
          icon={Receipt}
          title="Receipt Branding"
          description="Customize how receipts appear to customers."
        />
        <div className="space-y-4">
          <FormGroup label="Church / Organization Name">
            <TextInput
              value={form.org_name}
              onChange={set('org_name')}
              placeholder="e.g. St. Mary's Parish"
            />
          </FormGroup>
          <FormGroup label="Receipt Header Message">
            <TextArea
              value={form.receipt_header}
              onChange={set('receipt_header')}
              placeholder="e.g. Thank you for supporting our mission!"
              rows={2}
            />
          </FormGroup>
          <FormGroup label="Receipt Footer Message">
            <TextArea
              value={form.receipt_footer}
              onChange={set('receipt_footer')}
              placeholder="e.g. God bless you!"
              rows={2}
            />
          </FormGroup>
          <FormGroup label="Contact Information">
            <TextInput
              value={form.contact_info}
              onChange={set('contact_info')}
              placeholder="e.g. office@stmarys.org | +91 98765 43210"
            />
          </FormGroup>
        </div>
      </section>

      {/* ── Payment Methods ───────────────────────────────── */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-card p-6">
        <SectionHeader
          icon={CreditCard}
          title="Payment Methods"
          description="Choose which payment methods volunteers can record."
        />
        <div className="space-y-5">
          <Toggle
            checked={form.enable_cash}
            onChange={setCheck('enable_cash')}
            label="Cash"
            description="Accept cash payments at the counter."
          />
          <Toggle
            checked={form.enable_upi}
            onChange={setCheck('enable_upi')}
            label="UPI"
            description="Accept UPI / QR-code payments."
          />
          {form.enable_upi && (
            <div className="ml-14">
              <FormGroup label="UPI ID / Handle" hint="e.g. church@upi or 9876543210@paytm">
                <TextInput
                  value={form.upi_id}
                  onChange={set('upi_id')}
                  placeholder="yourname@upi"
                />
              </FormGroup>
            </div>
          )}
          <Toggle
            checked={form.enable_other}
            onChange={setCheck('enable_other')}
            label="Other"
            description="Allow recording payments as 'Other' (cheque, card, etc.)."
          />
        </div>
      </section>

      {/* Save Button */}
      <div className="flex justify-end pb-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-forest-600 hover:bg-forest-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60 shadow-card"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const TABS = [
  { id: 'team',     label: 'Team Members',   icon: Users },
  { id: 'settings', label: 'Event Settings', icon: Settings },
];

export default function TeamSettings() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('team');

  // Guard: only admins can access this page
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-forest-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <ShieldCheck className="w-10 h-10 text-gray-300" />
        <p className="text-sm text-gray-500 font-medium">
          Access Denied — Admin privileges required.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto">
      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Team &amp; Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your team members and configure event-wide settings.
        </p>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-8 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === id
                ? 'bg-white text-forest-700 shadow-card'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'team'     && <TeamMembersTab />}
      {activeTab === 'settings' && <EventSettingsTab />}
    </div>
  );
}
