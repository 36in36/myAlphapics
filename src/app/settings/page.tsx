'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { initDB, getSettings, saveSettings } from '@/lib/db';
import { prefetchPhrases } from '@/lib/audio';
import { namePhrases, wordBankPhrases } from '@/lib/phrases';

const MAX_PHOTOS = 5;

export default function SettingsPage() {
  const [childName, setChildName] = useState('');
  const [gameSpeed, setGameSpeed] = useState(1.0);
  const [photos, setPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [saved, setSaved] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState<{ done: number; total: number } | null>(null);
  const [words, setWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState('');
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initDB().then(async () => {
      const s = await getSettings();
      setChildName(s.childName);
      setGameSpeed(s.gameSpeed ?? 1.0);
      setWords(s.wordBank ?? []);
      if (s.profileImages && s.profileImages.length > 0) {
        setPhotos(s.profileImages.map((b) => ({ blob: b, url: URL.createObjectURL(b) })));
      }
    });
  }, []);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || photos.length >= MAX_PHOTOS) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = async () => {
      const size = 300;
      canvas.width = size;
      canvas.height = size;
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
      canvas.toBlob(async (blob) => {
        if (blob) {
          const newPhotos = [...photos, { blob, url: URL.createObjectURL(blob) }];
          setPhotos(newPhotos);
          await saveSettings({ profileImages: newPhotos.map((p) => p.blob) });
        }
      }, 'image/jpeg', 0.85);
    };
    img.src = URL.createObjectURL(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  }

  async function handleRemovePhoto(index: number) {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    await saveSettings({ profileImages: newPhotos.map((p) => p.blob) });
  }

  async function handleAddWord() {
    const w = newWord.trim().toUpperCase();
    if (w && !words.includes(w)) {
      const updated = [...words, w];
      setWords(updated);
      await saveSettings({ wordBank: updated });
    }
    setNewWord('');
  }

  async function handleRemoveWord(index: number) {
    const updated = words.filter((_, i) => i !== index);
    setWords(updated);
    await saveSettings({ wordBank: updated });
  }

  async function handleSave() {
    await saveSettings({ childName, gameSpeed, wordBank: words });

    // Generate the phrases that embed this name / these words now, while the
    // parent is here and online — otherwise the first play of each stalls
    // mid-game, or is silent offline.
    const phrases = [
      ...namePhrases(childName),
      ...words.flatMap((w) => wordBankPhrases(w)),
    ];
    if (phrases.length > 0) {
      setVoiceProgress({ done: 0, total: phrases.length });
      await prefetchPhrases(phrases, (done, total) => setVoiceProgress({ done, total }));
      setVoiceProgress(null);
    }

    setSaved(true);
    setTimeout(() => router.push('/'), 1200);
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-3xl">⬅️</Link>
        <h1 className="text-3xl font-extrabold text-purple-600">⚙️ Settings</h1>
      </div>

      {/* Child Name */}
      <div className="bg-white rounded-3xl p-6 shadow-xl mb-6">
        <label className="block">
          <span className="text-xl font-bold text-blue-600">👶 Child&apos;s Name</span>
          <p className="text-sm text-gray-400 mb-3">Games and celebrations will use this name!</p>
          <input
            type="text"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder="Enter name..."
            className="block w-full p-4 text-2xl rounded-2xl border-3 border-blue-300 focus:border-blue-500 outline-none text-center"
          />
        </label>
      </div>

      {/* Child Photos */}
      <div className="bg-white rounded-3xl p-6 shadow-xl mb-6">
        <h2 className="text-xl font-bold text-blue-600 mb-2">📸 Child&apos;s Photos</h2>
        <p className="text-sm text-gray-400 mb-4">
          Add up to {MAX_PHOTOS} photos — they&apos;ll appear during games and celebrations!
        </p>

        <div className="flex flex-wrap gap-3 justify-center mb-4">
          {photos.map((photo, i) => (
            <div key={i} className="relative group">
              <img
                src={photo.url}
                alt={`Photo ${i + 1}`}
                className="w-20 h-20 rounded-full object-cover border-3 border-blue-300 shadow-md"
              />
              <button
                onClick={() => handleRemovePhoto(i)}
                className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-bold shadow-md hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}

          {photos.length < MAX_PHOTOS && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 rounded-full bg-gray-50 border-3 border-dashed border-gray-300 flex items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <span className="text-2xl text-gray-400">+</span>
            </button>
          )}
        </div>

        {photos.length === 0 && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full px-6 py-3 bg-blue-500 text-white rounded-2xl font-bold hover:bg-blue-600 transition-colors"
          >
            📷 Add First Photo
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />

        <p className="text-xs text-gray-400 text-center mt-2">
          {photos.length}/{MAX_PHOTOS} photos • Tap + to add, hover to remove
        </p>
      </div>

      {/* Game Speed */}
      <div className="bg-white rounded-3xl p-6 shadow-xl mb-6">
        <h2 className="text-xl font-bold text-blue-600 mb-2">⏱️ Game Speed</h2>
        <p className="text-sm text-gray-400 mb-4">
          Controls how long images and prompts are shown between steps.
        </p>
        <div className="flex gap-3">
          {[
            { value: 1.5, label: '🐢', name: 'Relaxed', desc: 'More time to learn' },
            { value: 1.0, label: '🐰', name: 'Normal', desc: 'Standard pace' },
            { value: 0.7, label: '⚡', name: 'Quick', desc: 'For pros!' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setGameSpeed(opt.value)}
              className={`flex-1 p-3 rounded-2xl border-3 text-center transition-all ${
                gameSpeed === opt.value
                  ? 'border-green-400 bg-green-50 shadow-md'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="text-2xl mb-1">{opt.label}</div>
              <div className="font-bold text-sm">{opt.name}</div>
              <div className="text-xs text-gray-400">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Word Bank */}
      <div className="bg-white rounded-3xl p-6 shadow-xl mb-6">
        <h2 className="text-xl font-bold text-blue-600 mb-2">📖 Word Bank</h2>
        <p className="text-sm text-gray-400 mb-4">
          Add words for the Word Learning game. The game walks through each letter!
        </p>

        {words.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {words.map((word, i) => (
              <div key={i} className="flex items-center gap-1 bg-blue-50 border-2 border-blue-200 rounded-full px-3 py-1">
                <span className="font-bold text-blue-700 text-sm">{word}</span>
                <button
                  onClick={() => handleRemoveWord(i)}
                  className="w-5 h-5 flex items-center justify-center text-red-400 hover:text-red-600 font-bold text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value.replace(/[^a-zA-Z]/g, ''))}
            placeholder="Type a word..."
            className="flex-1 p-3 text-lg rounded-2xl border-2 border-blue-300 focus:border-blue-500 outline-none text-center uppercase"
            onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
            maxLength={12}
          />
          <button
            onClick={handleAddWord}
            disabled={!newWord.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-2xl font-bold hover:bg-blue-600 disabled:opacity-40 transition-colors"
          >
            + Add
          </button>
        </div>

        {words.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-3">
            Try words like: CAT, DOG, MOM, DAD, SUN
          </p>
        )}
      </div>

      <button onClick={handleSave} disabled={voiceProgress !== null} className="btn-kid bg-green-500 w-full disabled:opacity-70">
        {voiceProgress
          ? `🔊 Preparing voice… ${voiceProgress.done}/${voiceProgress.total}`
          : saved ? '✅ Saved!' : '💾 Save Settings'}
      </button>
    </div>
  );
}
