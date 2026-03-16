'use client';

import { useState, useRef, useEffect } from 'react';
import { activateApp } from '@/lib/db';

interface ActivationGateProps {
  onActivated: () => void;
}

export default function ActivationGate({ onActivated }: ActivationGateProps) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError('');

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (digit && index === 5 && newDigits.every(d => d !== '')) {
      handleSubmit(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newDigits = pasted.split('');
      setDigits(newDigits);
      handleSubmit(pasted);
    }
  };

  const handleSubmit = async (code?: string) => {
    const activationCode = code || digits.join('');
    if (activationCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const result = await activateApp(activationCode);

    if (result.valid) {
      setSuccess(result.message);
      setTimeout(() => onActivated(), 1500);
    } else {
      setError(result.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-6">
      <div className="text-6xl animate-bounce-slow">🔤</div>
      <h1 className="text-3xl font-bold text-blue-700">MyAlphaPics</h1>
      <p className="text-lg text-gray-600 text-center max-w-sm">
        Enter your 6-digit activation code to unlock the app
      </p>

      <div className="flex gap-2" onPaste={handlePaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={el => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className="w-12 h-14 text-center text-2xl font-bold border-2 border-blue-300 rounded-lg 
                       focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200
                       bg-white shadow-sm"
            disabled={loading}
          />
        ))}
      </div>

      {error && (
        <p className="text-red-500 font-semibold text-center animate-shake">{error}</p>
      )}
      {success && (
        <p className="text-green-500 font-semibold text-center text-lg">{success} 🎉</p>
      )}

      <button
        onClick={() => handleSubmit()}
        disabled={loading || digits.some(d => d === '')}
        className="btn-kid bg-green-500 px-8 py-3 text-xl disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '⏳ Checking...' : '✅ Activate'}
      </button>

      <p className="text-sm text-gray-400 text-center max-w-xs">
        You received this code via email after purchasing. Check your inbox for a message from MyAlphaPics.
      </p>
    </div>
  );
}
