import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Search,
  Plus,
  X,
  Phone,
  Clock,
  Pill,
  Syringe,
  Trash2,
  Pencil,
  AlertTriangle,
} from 'lucide-react';

// ============================================================================
// 1. SUPABASE CONFIGURATION
// Replace these two values with the keys from your Supabase Dashboard
// ============================================================================
const SUPABASE_URL = "https://bxkwlyidjodbnjfjddkk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4a3dseWlkam9kYm5qZmpkZGtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MjU3NTEsImV4cCI6MjEwMjIwMTc1MX0.tatftqDMqih28KJRzvL4tt8Inolmdpga3Bgb2fGuWg8";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DEFAULT_ACCESS_CODE = '0000';
const CYCLE_DAYS = 90;
const ALERT_LEAD_DAYS = { hormone: 30, peptide: 0 };

const CATEGORY = {
  hormone: { label: 'Hormone Replacement', icon: Pill },
  peptide: { label: 'Peptides', icon: Syringe },
};

const PEPTIDE_SUBTYPES = ['GLP-1', 'Other Peptide'];

function daysBetween(a, b) {
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function cycleStatus(startDate, category) {
  const start = new Date(startDate + 'T00:00:00');
  const now = new Date();
  const elapsed = daysBetween(start, now);
  const remaining = CYCLE_DAYS - elapsed;
  const lead = ALERT_LEAD_DAYS[category] ?? 30;
  let status = 'active';
  if (elapsed >= CYCLE_DAYS) status = 'overdue';
  else if (elapsed >= CYCLE_DAYS - lead) status = 'due';
  return { elapsed, remaining, status };
}

const STATUS_META = {
  active: { label: 'On cycle', dot: '#3E7A63', bg: '#EAF3EE', text: '#2C5C48' },
  due: {
    label: 'Due soon — call patient',
    dot: '#C97A2B',
    bg: '#FCF0E1',
    text: '#8A4E15',
  },
  overdue: {
    label: 'Overdue — renew now',
    dot: '#B23B3B',
    bg: '#FBE9E9',
    text: '#8A2424',
  },
};

const emptyForm = {
  name: '',
  age: '',
  category: 'hormone',
  subtype: 'GLP-1',
  medication: '',
  dose: '',
  pharmacy: '',
  startDate: new Date().toISOString().slice(0, 10),
  phone: '',
};

export default function App() {
  const [patients, setPatients] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [accessCode, setAccessCode] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [showChangeCode, setShowChangeCode] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newCodeConfirm, setNewCodeConfirm] = useState('');
  const [changeCodeError, setChangeCodeError] = useState('');

  // Fetch access code from Supabase settings table or fallback to default
  useEffect(() => {
    async function loadAccessCode() {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'access_code')
          .single();

        if (error || !data) {
          setAccessCode(DEFAULT_ACCESS_CODE);
        } else {
          setAccessCode(data.value);
        }
      } catch (e) {
        setAccessCode(DEFAULT_ACCESS_CODE);
      }
    }
    loadAccessCode();
  }, []);

  // Fetch patient records from Supabase
  const fetchPatients = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('patients').select('*');
      if (error) {
        setSaveError(true);
        setPatients([]);
      } else {
        setPatients(data || []);
      }
    } catch (e) {
      setPatients([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const submitCode = (e) => {
    e.preventDefault();
    if (codeInput === accessCode) {
      setUnlocked(true);
      setCodeError(false);
      setCodeInput('');
    } else {
      setCodeError(true);
    }
  };

  const submitChangeCode = async (e) => {
    e.preventDefault();
    if (!newCode.trim()) {
      setChangeCodeError('Enter a code.');
      return;
    }
    if (newCode !== newCodeConfirm) {
      setChangeCodeError("Codes don't match.");
      return;
    }
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'access_code', value: newCode.trim() });

      if (error) throw error;

      setAccessCode(newCode.trim());
      setShowChangeCode(false);
      setNewCode('');
      setNewCodeConfirm('');
      setChangeCodeError('');
    } catch (err) {
      setChangeCodeError("Couldn't save the new code. Try again.");
    }
  };

  const openAdd = () => {
    setForm({
      ...emptyForm,
      category: tab === 'peptide' ? 'peptide' : 'hormone',
    });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (p) => {
    setForm({ ...p, age: String(p.age ?? '') });
    setEditingId(p.id);
    setShowForm(true);
  };

  const saveForm = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.medication.trim() || !form.startDate) return;

    const record = {
      name: form.name.trim(),
      age: form.age ? Number(form.age) : null,
      category: form.category,
      subtype: form.category === 'peptide' ? form.subtype : '',
      medication: form.medication.trim(),
      dose: form.dose ? form.dose.trim() : '',
      pharmacy: form.pharmacy ? form.pharmacy.trim() : '',
      startDate: form.startDate,
      phone: form.phone ? form.phone.trim() : '',
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from('patients')
          .update(record)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('patients').insert([record]);
        if (error) throw error;
      }
      setSaveError(false);
      setShowForm(false);
      fetchPatients();
    } catch (err) {
      setSaveError(true);
    }
  };

  const removePatient = async (id) => {
    try {
      const { error } = await supabase.from('patients').delete().eq('id', id);
      if (error) throw error;
      setConfirmDelete(null);
      fetchPatients();
    } catch (err) {
      setSaveError(true);
    }
  };

  const filtered = useMemo(() => {
    if (!patients) return [];
    let list = patients;
    if (tab !== 'all') list = list.filter((p) => p.category === tab);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.medication && p.medication.toLowerCase().includes(q)) ||
          (p.pharmacy && p.pharmacy.toLowerCase().includes(q))
      );
    }
    return list
      .map((p) => ({ ...p, cycle: cycleStatus(p.startDate, p.category) }))
      .sort((a, b) => a.cycle.remaining - b.cycle.remaining);
  }, [patients, tab, query]);

  const counts = useMemo(() => {
    if (!patients) return { due: 0, overdue: 0 };
    let due = 0,
      overdue = 0;
    patients.forEach((p) => {
      const s = cycleStatus(p.startDate, p.category).status;
      if (s === 'due') due++;
      if (s === 'overdue') overdue++;
    });
    return { due, overdue };
  }, [patients]);

  if (accessCode === null) {
    return (
      <div style={styles.page}>
        <style>{fontImport}</style>
        <div style={styles.emptyState}>Loading…</div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div style={styles.lockPage}>
        <style>{fontImport}</style>
        <form style={styles.lockCard} onSubmit={submitCode}>
          <div style={styles.logoMark}>RC</div>
          <h1 style={styles.lockTitle}>Renewal Console</h1>
          <p style={styles.lockSub}>Enter the office access code to continue</p>
          <input
            autoFocus
            type="password"
            value={codeInput}
            onChange={(e) => {
              setCodeInput(e.target.value);
              setCodeError(false);
            }}
            style={{ ...styles.input, ...styles.lockInput }}
            placeholder="Access code"
          />
          {codeError && (
            <p style={styles.lockError}>That code isn't right — try again.</p>
          )}
          <button
            type="submit"
            style={{
              ...styles.addBtn,
              width: '100%',
              justifyContent: 'center',
            }}
          >
            Enter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style>{fontImport}</style>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoMark}>RC</div>
          <div>
            <h1 style={styles.title}>Renewal Console</h1>
            <p style={styles.subtitle}>
              Hormone &amp; peptide prescriptions, tracked by cycle
            </p>
          </div>
        </div>
        <div style={styles.headerRight}>
          {counts.overdue > 0 && (
            <span
              style={{
                ...styles.pill,
                background: STATUS_META.overdue.bg,
                color: STATUS_META.overdue.text,
              }}
            >
              <AlertTriangle
                size={14}
                style={{ marginRight: 6, verticalAlign: -2 }}
              />
              {counts.overdue} overdue
            </span>
          )}
          {counts.due > 0 && (
            <span
              style={{
                ...styles.pill,
                background: STATUS_META.due.bg,
                color: STATUS_META.due.text,
              }}
            >
              <Clock size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              {counts.due} due soon
            </span>
          )}
          <button
            style={styles.secondaryBtn}
            onClick={() => setShowChangeCode(true)}
          >
            Change access code
          </button>
        </div>
      </header>

      <div style={styles.controlsRow}>
        <div style={styles.tabs}>
          {[
            { key: 'all', label: 'All patients' },
            { key: 'hormone', label: 'Hormone Replacement' },
            { key: 'peptide', label: 'Peptides' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                ...styles.tabBtn,
                ...(tab === t.key ? styles.tabBtnActive : {}),
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={styles.searchWrap}>
          <Search
            size={16}
            color="#7A8B87"
            style={{ position: 'absolute', left: 12, top: 11 }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by patient, medication, or pharmacy"
            style={styles.searchInput}
          />
        </div>

        <button onClick={openAdd} style={styles.addBtn}>
          <Plus size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
          Add patient
        </button>
      </div>

      {saveError && (
        <div style={styles.saveErrorBanner}>
          Couldn't save your last change. Check your database connection and try
          again.
        </div>
      )}

      <main style={styles.main}>
        {!loaded ? (
          <div style={styles.emptyState}>Loading patient list…</div>
        ) : filtered.length === 0 ? (
          <div style={styles.emptyState}>
            {patients.length === 0
              ? 'No patients yet. Add your first patient to start tracking renewals.'
              : 'No patients match this search.'}
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <div style={{ ...styles.rowGrid, ...styles.tableHead }}>
              <div>Patient</div>
              <div>Category</div>
              <div>Medication</div>
              <div>Dose</div>
              <div>Pharmacy</div>
              <div>Started</div>
              <div>Cycle</div>
              <div></div>
            </div>
            {filtered.map((p) => {
              const meta = STATUS_META[p.cycle.status];
              const catInfo = CATEGORY[p.category] || CATEGORY.hormone;
              const Icon = catInfo.icon;
              const pct = Math.min(
                100,
                Math.max(0, (p.cycle.elapsed / CYCLE_DAYS) * 100)
              );
              return (
                <div
                  key={p.id}
                  style={{ ...styles.rowGrid, ...styles.tableRow }}
                >
                  <div style={styles.patientCell}>
                    <div style={styles.patientName}>{p.name}</div>
                    <div style={styles.patientAge}>
                      {p.age ? `Age ${p.age}` : ''}
                    </div>
                  </div>
                  <div style={styles.catCell}>
                    <Icon
                      size={14}
                      style={{
                        marginRight: 6,
                        verticalAlign: -2,
                        color: '#5A756E',
                      }}
                    />
                    <span>
                      {catInfo.label}
                      {p.category === 'peptide' && p.subtype
                        ? ` · ${p.subtype}`
                        : ''}
                    </span>
                  </div>
                  <div>{p.medication}</div>
                  <div>{p.dose}</div>
                  <div>{p.pharmacy}</div>
                  <div>
                    {new Date(p.startDate + 'T00:00:00').toLocaleDateString()}
                  </div>
                  <div>
                    <div style={styles.cycleTrack}>
                      <div
                        style={{
                          ...styles.cycleFill,
                          width: `${pct}%`,
                          background: meta.dot,
                        }}
                      />
                      {[30, 60, 90].map((m) => (
                        <div
                          key={m}
                          style={{
                            ...styles.cycleTick,
                            left: `${(m / CYCLE_DAYS) * 100}%`,
                          }}
                        />
                      ))}
                    </div>
                    <div
                      style={{
                        ...styles.statusBadge,
                        background: meta.bg,
                        color: meta.text,
                      }}
                    >
                      <span
                        style={{ ...styles.statusDot, background: meta.dot }}
                      />
                      {meta.label}
                      {p.cycle.status !== 'overdue'
                        ? ` (${p.cycle.remaining}d left)`
                        : ` (${Math.abs(p.cycle.remaining)}d over)`}
                    </div>
                  </div>
                  <div style={styles.rowActions}>
                    {p.phone && (
                      <a
                        href={`tel:${p.phone}`}
                        style={styles.iconBtn}
                        title={`Call ${p.phone}`}
                      >
                        <Phone size={15} />
                      </a>
                    )}
                    <button
                      style={styles.iconBtn}
                      onClick={() => openEdit(p)}
                      title="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      style={styles.iconBtn}
                      onClick={() => setConfirmDelete(p.id)}
                      title="Remove"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showForm && (
        <div style={styles.modalOverlay} onClick={() => setShowForm(false)}>
          <form
            style={styles.modal}
            onClick={(e) => e.stopPropagation()}
            onSubmit={saveForm}
          >
            <div style={styles.modalHead}>
              <h2 style={styles.modalTitle}>
                {editingId ? 'Edit patient' : 'Add patient'}
              </h2>
              <button
                type="button"
                style={styles.iconBtn}
                onClick={() => setShowForm(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span>Patient name</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span>Age</span>
                <input
                  type="number"
                  min="0"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span>Category</span>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  style={styles.input}
                >
                  <option value="hormone">Hormone Replacement</option>
                  <option value="peptide">Peptide</option>
                </select>
              </label>

              {form.category === 'peptide' && (
                <label style={styles.field}>
                  <span>Peptide type</span>
                  <select
                    value={form.subtype}
                    onChange={(e) =>
                      setForm({ ...form, subtype: e.target.value })
                    }
                    style={styles.input}
                  >
                    {PEPTIDE_SUBTYPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label style={styles.field}>
                <span>
                  {form.category === 'peptide'
                    ? 'Peptide name'
                    : 'Hormone name'}
                </span>
                <input
                  required
                  placeholder={
                    form.category === 'peptide'
                      ? 'e.g. Semaglutide'
                      : 'e.g. Testosterone cypionate'
                  }
                  value={form.medication}
                  onChange={(e) =>
                    setForm({ ...form, medication: e.target.value })
                  }
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span>Dose</span>
                <input
                  placeholder="e.g. 0.5mg weekly"
                  value={form.dose}
                  onChange={(e) => setForm({ ...form, dose: e.target.value })}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span>Pharmacy</span>
                <input
                  value={form.pharmacy}
                  onChange={(e) =>
                    setForm({ ...form, pharmacy: e.target.value })
                  }
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span>Start date</span>
                <input
                  required
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                <span>Phone (optional)</span>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  style={styles.input}
                />
              </label>
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button type="submit" style={styles.addBtn}>
                {editingId ? 'Save changes' : 'Add patient'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showChangeCode && (
        <div
          style={styles.modalOverlay}
          onClick={() => setShowChangeCode(false)}
        >
          <form
            style={styles.confirmBox}
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitChangeCode}
          >
            <h2 style={{ ...styles.modalTitle, marginBottom: 14 }}>
              Change access code
            </h2>
            <label style={{ ...styles.field, marginBottom: 12 }}>
              <span>New code</span>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                style={styles.input}
                autoFocus
              />
            </label>
            <label style={styles.field}>
              <span>Confirm new code</span>
              <input
                type="text"
                value={newCodeConfirm}
                onChange={(e) => setNewCodeConfirm(e.target.value)}
                style={styles.input}
              />
            </label>
            {changeCodeError && (
              <p style={styles.lockError}>{changeCodeError}</p>
            )}
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => setShowChangeCode(false)}
              >
                Cancel
              </button>
              <button type="submit" style={styles.addBtn}>
                Save code
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmDelete && (
        <div style={styles.modalOverlay} onClick={() => setConfirmDelete(null)}>
          <div style={styles.confirmBox} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: '0 0 16px', color: '#33403C' }}>
              Remove this patient from the list?
            </p>
            <div style={styles.modalActions}>
              <button
                style={styles.secondaryBtn}
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                style={{ ...styles.addBtn, background: '#B23B3B' }}
                onClick={() => removePatient(confirmDelete)}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const fontImport = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap');
`;

const styles = {
  page: {
    minHeight: '100vh',
    background: '#F3F6F5',
    fontFamily: "'Inter', -apple-system, sans-serif",
    color: '#25302D',
    padding: '24px 32px 60px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: '#1F4D42',
    color: '#EAF3EE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Fraunces', serif",
    fontWeight: 600,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: "'Fraunces', serif",
    fontWeight: 600,
    fontSize: 26,
    margin: 0,
    color: '#1B2A26',
  },
  subtitle: { margin: '2px 0 0', fontSize: 13.5, color: '#6B7A75' },
  headerRight: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 14px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
  },
  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  tabs: {
    display: 'flex',
    background: '#E4EAE7',
    borderRadius: 10,
    padding: 4,
    gap: 2,
  },
  tabBtn: {
    border: 'none',
    background: 'transparent',
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 13.5,
    fontWeight: 600,
    color: '#5A6D66',
    cursor: 'pointer',
  },
  tabBtnActive: {
    background: '#FFFFFF',
    color: '#1F4D42',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
  },
  searchWrap: { position: 'relative', flex: '1 1 260px', minWidth: 220 },
  searchInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 12px 9px 34px',
    borderRadius: 10,
    border: '1px solid #D7E0DC',
    fontSize: 14,
    outline: 'none',
    background: '#fff',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    border: 'none',
    background: '#1F4D42',
    color: '#fff',
    padding: '10px 18px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryBtn: {
    border: '1px solid #D7E0DC',
    background: '#fff',
    color: '#33403C',
    padding: '10px 18px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  saveErrorBanner: {
    background: '#FBE9E9',
    color: '#8A2424',
    padding: '10px 16px',
    borderRadius: 10,
    fontSize: 13.5,
    marginBottom: 16,
  },
  main: {},
  emptyState: {
    padding: '60px 20px',
    textAlign: 'center',
    color: '#6B7A75',
    background: '#fff',
    borderRadius: 14,
    border: '1px dashed #D7E0DC',
    fontSize: 14.5,
  },
  tableWrap: {
    background: '#fff',
    borderRadius: 14,
    border: '1px solid #E3E9E6',
    overflow: 'hidden',
  },
  rowGrid: {
    display: 'grid',
    gridTemplateColumns: '1.3fr 1.4fr 1.3fr 1.2fr 1.1fr 0.9fr 1.6fr 0.8fr',
    gap: 12,
    alignItems: 'center',
    padding: '14px 18px',
  },
  tableHead: {
    background: '#EEF3F1',
    fontSize: 11.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#5A6D66',
  },
  tableRow: {
    borderTop: '1px solid #EEF2F0',
    fontSize: 13.5,
  },
  patientCell: {},
  patientName: { fontWeight: 600, color: '#1B2A26' },
  patientAge: { fontSize: 12, color: '#7A8B87' },
  catCell: { display: 'flex', alignItems: 'center', fontSize: 13 },
  cycleTrack: {
    position: 'relative',
    height: 6,
    background: '#E4EAE7',
    borderRadius: 999,
    marginBottom: 6,
    overflow: 'hidden',
  },
  cycleFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  cycleTick: {
    position: 'absolute',
    top: -1,
    bottom: -1,
    width: 1,
    background: 'rgba(255,255,255,0.6)',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 11.5,
    fontWeight: 600,
    padding: '3px 9px',
    borderRadius: 999,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginRight: 6,
    display: 'inline-block',
  },
  rowActions: { display: 'flex', gap: 4, justifyContent: 'flex-end' },
  iconBtn: {
    border: 'none',
    background: 'transparent',
    color: '#5A6D66',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 8,
    display: 'inline-flex',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(20,30,27,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    padding: 20,
  },
  modal: {
    background: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 640,
    maxHeight: '88vh',
    overflowY: 'auto',
    padding: 24,
  },
  modalHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: "'Fraunces', serif",
    fontWeight: 600,
    fontSize: 20,
    margin: 0,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: 12.5,
    fontWeight: 600,
    color: '#5A6D66',
    gap: 6,
  },
  input: {
    padding: '9px 11px',
    borderRadius: 9,
    border: '1px solid #D7E0DC',
    fontSize: 14,
    fontFamily: 'inherit',
    color: '#25302D',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  confirmBox: {
    background: '#fff',
    borderRadius: 14,
    padding: 24,
    maxWidth: 360,
    width: '100%',
  },
  lockPage: {
    minHeight: '100vh',
    background: '#F3F6F5',
    fontFamily: "'Inter', -apple-system, sans-serif",
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  lockCard: {
    background: '#fff',
    borderRadius: 16,
    padding: '36px 32px',
    width: '100%',
    maxWidth: 340,
    textAlign: 'center',
    boxShadow: '0 8px 30px rgba(31,77,66,0.08)',
  },
  lockTitle: {
    fontFamily: "'Fraunces', serif",
    fontWeight: 600,
    fontSize: 22,
    margin: '16px 0 4px',
    color: '#1B2A26',
  },
  lockSub: { fontSize: 13.5, color: '#6B7A75', margin: '0 0 18px' },
  lockInput: {
    width: '100%',
    boxSizing: 'border-box',
    marginBottom: 10,
    textAlign: 'center',
  },
  lockError: { color: '#B23B3B', fontSize: 13, margin: '0 0 12px' },
};
