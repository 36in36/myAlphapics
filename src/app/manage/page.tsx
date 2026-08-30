'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db, initDB, type Letter } from '@/lib/db';
import { prefetchPhrases } from '@/lib/audio';
import { resizeImage, LETTER_PHOTO_MAX } from '@/lib/image';
import { letterWordPhrases } from '@/lib/phrases';

export default function ManagePage() {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [editing, setEditing] = useState<Letter | null>(null);
  const [editWord, setEditWord] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    initDB().then(loadLetters);
  }, []);

  async function loadLetters() {
    const all = await db.letters.orderBy('letter').toArray();
    setLetters(all);
  }

  function startEdit(letter: Letter) {
    setEditing(letter);
    setEditWord(letter.word);
    setPreviewUrl(null);
    setPendingBlob(null);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const blob = await resizeImage(file, LETTER_PHOTO_MAX);
    setPendingBlob(blob);
    setPreviewUrl(URL.createObjectURL(blob));
  }

  async function saveEdit() {
    if (!editing?.id) return;
    const updates: Partial<Letter> = { word: editWord };
    if (pendingBlob) {
      updates.imageBlob = pendingBlob;
      updates.imagePath = '__custom__';
    }
    await db.letters.update(editing.id, updates);

    // "G is for Grandma" is parent-authored, so it cannot be pre-bundled.
    // Generate it now rather than stalling mid-game on first play. The photo
    // is already saved above — audio never blocks the save.
    const phrases = letterWordPhrases(editing.letter, editWord);
    if (phrases.length > 0) {
      setPreparing(true);
      await prefetchPhrases(phrases);
      setPreparing(false);
    }

    setEditing(null);
    setPreviewUrl(null);
    setPendingBlob(null);
    loadLetters();
  }

  function getImageSrc(letter: Letter): string {
    if (letter.imageBlob) return URL.createObjectURL(letter.imageBlob);
    return letter.imagePath;
  }

  const colors = [
    'bg-red-100 border-red-300', 'bg-orange-100 border-orange-300',
    'bg-yellow-100 border-yellow-300', 'bg-green-100 border-green-300',
    'bg-teal-100 border-teal-300', 'bg-blue-100 border-blue-300',
    'bg-indigo-100 border-indigo-300', 'bg-purple-100 border-purple-300',
    'bg-pink-100 border-pink-300',
  ];

  return (
    <div className="min-h-screen p-4">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="text-3xl">⬅️</Link>
        <h1 className="text-3xl font-extrabold text-blue-600">📸 Letter Management</h1>
      </div>

      <a
        href="/manage/counting/"
        className="mb-5 flex items-center gap-3 rounded-2xl bg-orange-100 p-3 shadow-sm transition-transform hover:scale-[1.01] active:scale-95"
      >
        <span className="text-3xl">🔢</span>
        <div className="flex-1">
          <p className="font-extrabold text-orange-700">Counting Setup</p>
          <p className="text-sm text-orange-600/70">
            Counting already uses these photos. Tap to curate sets or set up Photo Count.
          </p>
        </div>
        <span className="text-2xl text-orange-400">›</span>
      </a>

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <h2 className="text-3xl font-bold text-center mb-4">
              Edit Letter {editing.letter}
            </h2>
            <div className="flex justify-center mb-4">
              <img
                src={previewUrl || getImageSrc(editing)}
                alt={editing.letter}
                className="w-40 h-40 object-contain rounded-2xl border-4 border-blue-200"
              />
            </div>
            <label className="block mb-3">
              <span className="text-lg font-semibold">Word:</span>
              <input
                type="text"
                value={editWord}
                onChange={(e) => setEditWord(e.target.value)}
                className="block w-full mt-1 p-3 text-xl rounded-xl border-2 border-blue-300 focus:border-blue-500 outline-none"
              />
            </label>
            <label className="block mb-4">
              <span className="text-lg font-semibold">New Photo:</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="block w-full mt-1 text-lg"
              />
            </label>
            <div className="flex gap-3">
              <button onClick={saveEdit} disabled={preparing} className="btn-kid bg-green-500 flex-1 text-lg py-3 disabled:opacity-70">
                ✅ Save
              </button>
              <button onClick={() => { setEditing(null); setPreviewUrl(null); }} className="btn-kid bg-gray-400 flex-1 text-lg py-3">
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {letters.map((l, i) => (
          <button
            key={l.id}
            onClick={() => startEdit(l)}
            className={`${colors[i % colors.length]} border-2 rounded-2xl p-2 flex flex-col items-center gap-1 transition-transform hover:scale-105 active:scale-95 shadow-md`}
          >
            <img
              src={getImageSrc(l)}
              alt={l.word}
              className="w-16 h-16 object-contain rounded-xl"
            />
            <span className="text-2xl font-extrabold">{l.letter}</span>
            <span className="text-xs font-semibold truncate w-full text-center">{l.word}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
