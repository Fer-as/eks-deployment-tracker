import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const emptyForm = { application_name: '', environment: '', version: '', status: 'pending' };
const labels = { pending: 'Pending', in_progress: 'In progress', succeeded: 'Succeeded', failed: 'Failed' };

async function request(path, options) {
  const response = await fetch(`/api${path}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function App() {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try { setRecords(await request('/deployments')); }
    catch (err) { setError(`Could not load deployments: ${err.message}`); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const record = await request('/deployments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      setRecords(current => [record, ...current]);
      setForm(emptyForm);
      setNotice('Deployment created.');
    } catch (err) { setError(`Could not create deployment: ${err.message}`); }
    finally { setSaving(false); }
  }

  return <main>
    <header><p className="eyebrow">MILESTONE 1</p><h1>Deployment Tracker</h1><p>A simple record of what shipped, where, and how it went.</p></header>
    <section aria-labelledby="create-title">
      <h2 id="create-title">Create deployment</h2>
      <form onSubmit={submit}>
        <fieldset disabled={saving || loading}>
          {[['application_name', 'Application name', 'payments-api'], ['environment', 'Environment', 'staging'], ['version', 'Version', '1.0.0']].map(([field, label, placeholder]) =>
            <label key={field}>{label}<input required maxLength={100} value={form[field]} placeholder={placeholder} onChange={event => setForm({ ...form, [field]: event.target.value })} /></label>)}
          <label>Status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button type="submit">{saving ? 'Creating…' : 'Create deployment'}</button>
        </fieldset>
      </form>
    </section>
    {error && <p className="error" role="alert">{error}</p>}
    <p role="status">{notice}</p>
    <section aria-labelledby="records-title">
      <div className="section-header"><h2 id="records-title">Deployments <span className="count">{records.length}</span></h2><button className="secondary" disabled={loading || saving} onClick={load}>Refresh</button></div>
      {loading ? <p role="status">Loading deployments…</p> : records.length === 0 ? <p>No deployments to display. Create your first deployment above.</p> :
        <div className="table-wrap"><table><thead><tr><th>Application</th><th>Environment</th><th>Version</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>{records.map(record => <tr key={record.id}><td>{record.application_name}</td><td>{record.environment}</td><td><code>{record.version}</code></td><td><span className={`badge ${record.status}`}>{labels[record.status]}</span></td><td>{new Date(record.created_at).toLocaleString()}</td></tr>)}</tbody>
        </table></div>}
    </section>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
