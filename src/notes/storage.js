// Any object with async load() and save(notes) works. Swap adapters without touching the rest.

export const localStorageAdapter = {
  key: 'notes-v1',
  async load() {
    try { return JSON.parse(localStorage.getItem(this.key)) ?? []; }
    catch { return []; }
  },
  async save(notes) {
    localStorage.setItem(this.key, JSON.stringify(notes));
  },
};

// Server storage: adjust the URL / method / auth headers to match your API.
export const apiAdapter = (base = '/api/notes') => ({
  async load() {
    const res = await fetch(base);
    return res.ok ? res.json() : [];
  },
  async save(notes) {
    await fetch(base, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notes),
    });
  },
});