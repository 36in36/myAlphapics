'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  initDB, getSettings, saveSettings, getCountingPool,
  getCountGroups, addCountGroup, deleteCountGroup,
  getCountItems, addCountItem, deleteCountItem,
  getCountScenes, addCountScene, deleteCountScene,
  type CountablePhoto, type CountGroup, type CountItem, type CountScene,
} from '@/lib/db';
import { resizeImage, LETTER_PHOTO_MAX, SCENE_PHOTO_MAX } from '@/lib/image';

type Tab = 'sets' | 'photos';

interface SceneDraft {
  blob: Blob;
  url: string;
  regions: { x: number; y: number }[];
  name: string;
}

/**
 * Parent setup for the Numbers modes.
 *
 * Everything here is optional. Counting already works from the photos loaded
 * for letters, and adding another setup wall in front of a new mode is the
 * fastest way to make sure nobody sees it. This screen exists for parents who
 * want to curate — and for Photo Count, which genuinely cannot work without it.
 */
export default function ManageCountingPage() {
  const [tab, setTab] = useState<Tab>('sets');
  const [maxCount, setMaxCount] = useState(5);
  const [pool, setPool] = useState<CountablePhoto[]>([]);
  const [poolUrls, setPoolUrls] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<CountGroup[]>([]);
  const [items, setItems] = useState<Record<number, CountItem[]>>({});
  const [itemUrls, setItemUrls] = useState<Record<number, string>>({});
  const [scenes, setScenes] = useState<CountScene[]>([]);
  const [sceneUrls, setSceneUrls] = useState<Record<number, string>>({});
  const [newGroupName, setNewGroupName] = useState('');
  const [draft, setDraft] = useState<SceneDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const urlsRef = useRef<string[]>([]);

  const track = useCallback((url: string) => {
    urlsRef.current.push(url);
    return url;
  }, []);

  const load = useCallback(async () => {
    await initDB();
    const [settings, photos, groupRows, sceneRows] = await Promise.all([
      getSettings(), getCountingPool(), getCountGroups(), getCountScenes(),
    ]);

    setMaxCount(settings.maxCount ?? 5);
    setPool(photos);
    setPoolUrls(Object.fromEntries(photos.map((p) => [
      p.key, p.imageBlob ? track(URL.createObjectURL(p.imageBlob)) : p.imagePath,
    ])));

    setGroups(groupRows);
    const itemMap: Record<number, CountItem[]> = {};
    const itemUrlMap: Record<number, string> = {};
    for (const g of groupRows) {
      if (!g.id) continue;
      const rows = await getCountItems(g.id);
      itemMap[g.id] = rows;
      // Built once here rather than in render: createObjectURL inside JSX
      // allocates a fresh URL on every pass and never frees it.
      for (const item of rows) {
        if (item.id && item.imageBlob) itemUrlMap[item.id] = track(URL.createObjectURL(item.imageBlob));
      }
    }
    setItems(itemMap);
    setItemUrls(itemUrlMap);

    setScenes(sceneRows);
    setSceneUrls(Object.fromEntries(
      sceneRows.filter((s) => s.id).map((s) => [s.id!, track(URL.createObjectURL(s.imageBlob))])
    ));
  }, [track]);

  useEffect(() => {
    load();
    return () => {
      for (const url of urlsRef.current) URL.revokeObjectURL(url);
      urlsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeMaxCount(value: number) {
    setMaxCount(value);
    await saveSettings({ maxCount: value });
  }

  // ── Curated sets ───────────────────────────────────────────
  async function handleAddGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    await addCountGroup(name);
    setNewGroupName('');
    load();
  }

  async function handleAddItem(groupId: number, file: File, label: string) {
    setBusy(true);
    const blob = await resizeImage(file, LETTER_PHOTO_MAX);
    await addCountItem(groupId, label || 'Photo', blob);
    setBusy(false);
    load();
  }

  // ── Photo Count scenes ─────────────────────────────────────
  async function handleSceneFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const blob = await resizeImage(file, SCENE_PHOTO_MAX);
    setBusy(false);
    setDraft({ blob, url: track(URL.createObjectURL(blob)), regions: [], name: '' });
  }

  /** Tapping the photo drops a marker where the countable thing is. */
  function handleSceneTap(e: React.MouseEvent<HTMLImageElement>) {
    if (!draft) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    if (draft.regions.length >= 10) return;
    setDraft({ ...draft, regions: [...draft.regions, { x, y }] });
  }

  function removeRegion(index: number) {
    if (!draft) return;
    setDraft({ ...draft, regions: draft.regions.filter((_, i) => i !== index) });
  }

  async function saveScene() {
    if (!draft || draft.regions.length === 0) return;
    setBusy(true);
    await addCountScene(draft.name.trim() || 'Our photo', draft.blob, draft.regions);
    setBusy(false);
    setDraft(null);
    load();
  }

  const derivedNote =
    pool.length === 0 ? 'No photos found yet.'
      : pool[0].key.startsWith('default-')
        ? `Using the ${pool.length} pictures that came with the app.`
        : pool[0].key.startsWith('item-')
          ? `Using ${pool.length} photos from your counting sets.`
          : `Using ${pool.length} photos you already added for letters.`;

  return (
    <div className="mx-auto min-h-screen max-w-2xl p-4">
      <div className="mb-5 flex items-center gap-4">
        <a href="/manage/" className="text-3xl">⬅️</a>
        <h1 className="text-3xl font-extrabold text-orange-600">🔢 Counting Setup</h1>
      </div>

      {/* How high do we count? */}
      <div className="mb-5 rounded-2xl bg-white p-4 shadow-md">
        <p className="mb-1 text-lg font-bold text-gray-700">How high should we count?</p>
        <p className="mb-3 text-sm text-gray-400">
          Start at 5. Understanding &ldquo;how many&rdquo; is built on small sets first — counting
          higher comes later and comes easily.
        </p>
        <div className="flex gap-3">
          {[3, 5, 10].map((value) => (
            <button
              key={value}
              onClick={() => changeMaxCount(value)}
              className={`flex-1 rounded-2xl py-3 text-xl font-extrabold transition-all ${
                maxCount === value
                  ? 'bg-orange-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-500 hover:bg-orange-100'
              }`}
            >
              Up to {value}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex gap-2 rounded-2xl bg-gray-100 p-1">
        <button
          onClick={() => setTab('sets')}
          className={`flex-1 rounded-xl py-2 font-bold transition-all ${tab === 'sets' ? 'bg-white text-orange-600 shadow' : 'text-gray-400'}`}
        >
          🖼️ Counting sets
        </button>
        <button
          onClick={() => setTab('photos')}
          className={`flex-1 rounded-xl py-2 font-bold transition-all ${tab === 'photos' ? 'bg-white text-rose-600 shadow' : 'text-gray-400'}`}
        >
          👨‍👩‍👧 Photo Count
        </button>
      </div>

      {tab === 'sets' && (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl bg-white p-4 shadow-md">
            <p className="mb-2 text-lg font-bold text-gray-700">What we&apos;re counting now</p>
            <p className="mb-3 text-sm text-gray-400">{derivedNote}</p>
            <div className="flex flex-wrap gap-2">
              {pool.slice(0, 12).map((p) => (
                <img
                  key={p.key}
                  src={poolUrls[p.key]}
                  alt={p.label}
                  className="h-14 w-14 rounded-xl border-2 border-orange-200 object-cover"
                />
              ))}
            </div>
            <p className="mt-3 text-sm text-gray-400">
              Nothing to do here — counting already works. Make a set below only if you want
              specific photos, like just the cousins.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-md">
            <p className="mb-3 text-lg font-bold text-gray-700">Your counting sets</p>
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Set name, e.g. Cousins"
                className="flex-1 rounded-xl border-2 border-orange-200 p-3 text-lg outline-none focus:border-orange-400"
              />
              <button onClick={handleAddGroup} className="btn-kid bg-orange-500 px-5 text-base">Add</button>
            </div>

            {groups.length === 0 && (
              <p className="text-sm text-gray-400">No sets yet.</p>
            )}

            <div className="flex flex-col gap-4">
              {groups.map((group) => (
                <div key={group.id} className="rounded-xl border-2 border-gray-100 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-lg font-bold text-gray-700">{group.name}</p>
                    <button
                      onClick={() => group.id && deleteCountGroup(group.id).then(load)}
                      className="text-sm text-red-400 underline"
                    >
                      Delete set
                    </button>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-2">
                    {(items[group.id!] ?? []).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => item.id && deleteCountItem(item.id).then(load)}
                        title={`Remove ${item.label}`}
                        className="relative h-16 w-16 overflow-hidden rounded-xl border-2 border-orange-200"
                      >
                        {item.id && itemUrls[item.id] && (
                          <img src={itemUrls[item.id]} alt={item.label} className="h-full w-full object-cover" />
                        )}
                        <span className="absolute right-0 top-0 rounded-bl bg-red-500 px-1 text-xs font-bold text-white">×</span>
                      </button>
                    ))}
                  </div>

                  <label className="text-sm font-semibold text-gray-500">
                    Add a photo
                    <input
                      type="file"
                      accept="image/*"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && group.id) handleAddItem(group.id, file, file.name.replace(/\.[^.]+$/, ''));
                        e.target.value = '';
                      }}
                      className="mt-1 block w-full text-sm"
                    />
                  </label>
                </div>
              ))}
            </div>

            {groups.length > 0 && (
              <p className="mt-4 text-sm text-gray-400">
                Counting uses the photos from all your sets together, once there are two or more.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === 'photos' && (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl bg-white p-4 shadow-md">
            <p className="mb-1 text-lg font-bold text-gray-700">Count people in a real photo</p>
            <p className="mb-3 text-sm text-gray-400">
              Pick a photo, then tap each person or thing you want counted. Tap a marker again to
              remove it. The app can&apos;t guess which people count, so this part is on you.
            </p>

            {!draft && (
              <label className="text-sm font-semibold text-gray-500">
                Choose a photo
                <input type="file" accept="image/*" disabled={busy} onChange={handleSceneFile} className="mt-1 block w-full text-sm" />
              </label>
            )}

            {draft && (
              <div className="flex flex-col gap-3">
                <div className="relative inline-block self-center">
                  <img
                    src={draft.url}
                    alt="New counting photo"
                    onClick={handleSceneTap}
                    className="block max-h-[50vh] w-auto max-w-full cursor-crosshair rounded-2xl border-4 border-rose-200"
                  />
                  {draft.regions.map((region, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); removeRegion(i); }}
                      style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%` }}
                      className="absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-rose-500 text-lg font-extrabold text-white shadow-lg"
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                <p className="text-center text-lg font-bold text-rose-600">
                  {draft.regions.length === 0
                    ? 'Tap each person or thing to count'
                    : `${draft.regions.length} marked`}
                </p>

                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Name this photo, e.g. The cousins"
                  className="rounded-xl border-2 border-rose-200 p-3 text-lg outline-none focus:border-rose-400"
                />

                <div className="flex gap-3">
                  <button
                    onClick={saveScene}
                    disabled={busy || draft.regions.length === 0}
                    className="btn-kid flex-1 bg-green-500 py-3 text-lg disabled:opacity-50"
                  >
                    ✅ Save
                  </button>
                  <button onClick={() => setDraft(null)} className="btn-kid flex-1 bg-gray-400 py-3 text-lg">
                    ❌ Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-md">
            <p className="mb-3 text-lg font-bold text-gray-700">Saved photos</p>
            {scenes.length === 0 && <p className="text-sm text-gray-400">None yet.</p>}
            <div className="flex flex-col gap-3">
              {scenes.map((scene) => (
                <div key={scene.id} className="flex items-center gap-3 rounded-xl border-2 border-gray-100 p-2">
                  <img src={sceneUrls[scene.id!]} alt={scene.name} className="h-16 w-16 rounded-xl object-cover" />
                  <div className="flex-1">
                    <p className="font-bold text-gray-700">{scene.name}</p>
                    <p className="text-sm text-gray-400">{scene.regions.length} to count</p>
                  </div>
                  <button
                    onClick={() => scene.id && deleteCountScene(scene.id).then(load)}
                    className="text-sm text-red-400 underline"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
