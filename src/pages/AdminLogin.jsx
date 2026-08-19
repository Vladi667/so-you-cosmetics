import React, { useState } from 'react';

const AdminLogin = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    fetch('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    })
      .then(res => {
        if (!res.ok) {
          throw new Error('Identifiants incorrects');
        }
        return res.json();
      })
      .then(data => {
        setIsLoading(false);
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminUser', data.username);
        onLoginSuccess();
      })
      .catch(err => {
        setIsLoading(false);
        setError(err.message || 'Une erreur est survenue');
      });
  };

  return (
    <div className="min-h-screen bg-mist-white flex items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Subtle background blurs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-limestone/40 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-900/[0.02] rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md bg-ivory rounded-3xl p-8 sm:p-12 shadow-[0_20px_60px_rgba(0,0,0,0.05)] border border-slate-stone/5">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 bg-mist-white rounded-2xl items-center justify-center mb-4 text-slate-stone">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="font-serif text-3xl text-slate-stone mb-2">Espace Admin</h1>
          <p className="font-sans text-xs tracking-widest uppercase text-stone-gray/60">So You Cosmetics Geneva</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 rounded-2xl border border-red-100 text-red-600 text-sm font-sans flex items-center gap-3 animate-headShake">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block font-sans text-[10px] sm:text-xs tracking-[0.2em] uppercase font-bold text-slate-stone mb-2">Identifiant</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3.5 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40 focus:ring-2 focus:ring-slate-stone/10 transition-all duration-300"
              placeholder="Nom d'utilisateur"
            />
          </div>

          <div>
            <label className="block font-sans text-[10px] sm:text-xs tracking-[0.2em] uppercase font-bold text-slate-stone mb-2">Mot de passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3.5 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40 focus:ring-2 focus:ring-slate-stone/10 transition-all duration-300"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-slate-stone text-white font-sans uppercase tracking-[0.3em] text-xs rounded-full hover:bg-slate-stone/90 transition-all duration-250 shadow-lg hover:shadow-xl transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
