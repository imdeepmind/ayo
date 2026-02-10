import { useState } from 'react';
import logo from './assets/images/logo-universal.png';
import { Greet } from '../wailsjs/go/main/App';

function App() {
  const [resultText, setResultText] = useState('Please enter your name below 👇');
  const [name, setName] = useState('');

  const updateName = (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value);
  const updateResultText = (result: string) => setResultText(result);

  function greet() {
    Greet(name).then(updateResultText);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100">
      <div className="w-full max-w-md mx-4 rounded-2xl bg-slate-800/80 border border-slate-700 shadow-2xl shadow-slate-900/60 p-8">
        <div className="flex flex-col items-center gap-4 mb-6">
          <img
            src={logo}
            alt="logo"
            className="w-24 h-24 object-contain drop-shadow-[0_0_25px_rgba(56,189,248,0.55)]"
          />
          <h1 className="text-2xl font-semibold tracking-tight">
            Wails + React + <span className="text-sky-400">Tailwind</span>
          </h1>
          <p className="text-sm text-slate-300">
            If this card looks nicely styled, Tailwind is working.
          </p>
        </div>

        <div className="mb-4 text-center">
          <p className="text-sm font-medium text-sky-300">{resultText}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="off"
            value={name}
            onChange={updateName}
            placeholder="Enter your name"
            className="flex-1 rounded-lg bg-slate-900/70 border border-slate-600 px-3 py-2 text-sm
                       placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500
                       focus:border-sky-500 transition"
          />
          <button
            type="button"
            onClick={greet}
            className="inline-flex items-center justify-center rounded-lg bg-sky-500 px-4 py-2 text-sm
                       font-medium text-slate-950 shadow-md shadow-sky-500/40 hover:bg-sky-400
                       active:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-400
                       focus:ring-offset-2 focus:ring-offset-slate-900 transition"
          >
            Greet
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
