'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initDB, getSettings, getComprehensiveReport, getNumberMasteryData, getMaxCount, type Progress, type LetterMastery, type InteractionSession, type NumberMastery } from '@/lib/db';

type Tab = 'exposure' | 'interaction' | 'mastery' | 'numbers';

interface ReportData {
  exposureData: Progress[];
  masteryData: LetterMastery[];
  interactionHistory: InteractionSession[];
  overallAccuracy: number;
  lettersStarted: number;
  lettersMastered: number;
}

const MASTERY_LEVELS = [
  { label: 'Not Started', color: 'bg-gray-200', text: 'text-gray-500' },
  { label: 'Beginning', color: 'bg-blue-100', text: 'text-blue-800' },
  { label: 'Learning', color: 'bg-blue-300', text: 'text-white' },
  { label: 'Practicing', color: 'bg-blue-500', text: 'text-white' },
  { label: 'Improving', color: 'bg-blue-700', text: 'text-white' },
  { label: 'Mastered', color: 'bg-blue-900', text: 'text-white' },
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function formatDate(date: string | Date | undefined): string {
  if (!date) return 'Never';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ReportsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('exposure');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLetter, setSelectedLetter] = useState<LetterMastery | null>(null);
  const [numberData, setNumberData] = useState<NumberMastery[]>([]);
  const [maxCount, setMaxCount] = useState(5);

  useEffect(() => {
    (async () => {
      try {
        await initDB();
        const settings = await getSettings();
        setMaxCount(await getMaxCount());
        if (settings?.childName) {
          const [data, numbers] = await Promise.all([
            getComprehensiveReport(settings.childName),
            getNumberMasteryData(settings.childName),
          ]);
          setReport(data);
          setNumberData(numbers);
        }
      } catch (e) {
        console.error('Failed to load report:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tabs: { key: Tab; label: string; emoji: string }[] = [
    { key: 'exposure', label: 'Exposure', emoji: '👀' },
    { key: 'interaction', label: 'Interaction', emoji: '🎯' },
    { key: 'mastery', label: 'Mastery', emoji: '⭐' },
    { key: 'numbers', label: 'Numbers', emoji: '🔢' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-300 border-t-purple-600 mx-auto mb-4" />
          <p className="text-xl font-bold text-purple-700">Loading Reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 hover:bg-purple-200 transition-colors"
          >
            ←
          </button>
          <h1 className="text-2xl font-extrabold text-purple-800">📊 Progress Reports</h1>
        </div>

        {/* Tab Bar */}
        <div className="max-w-2xl mx-auto px-4 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-center font-bold text-sm rounded-t-xl transition-all ${
                activeTab === tab.key
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
              }`}
            >
              <span className="text-lg">{tab.emoji}</span>
              <br />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {!report && activeTab !== 'numbers' ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-md">
            <p className="text-6xl mb-4">📭</p>
            <p className="text-xl font-bold text-gray-600">No data yet</p>
            <p className="text-gray-400 mt-2">Start learning to see progress here!</p>
          </div>
        ) : (
          <>
            {report && activeTab === 'exposure' && <ExposureTab data={report.exposureData} />}
            {report && activeTab === 'interaction' && <InteractionTab report={report} />}
            {report && activeTab === 'mastery' && (
              <MasteryTab
                report={report}
                selectedLetter={selectedLetter}
                onSelectLetter={setSelectedLetter}
              />
            )}
            {activeTab === 'numbers' && <NumbersTab data={numberData} maxCount={maxCount} />}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Tab 1: Exposure ─── */
function ExposureTab({ data }: { data: Progress[] }) {
  const filtered = data.filter((d) => d.exposureCount > 0);
  const TARGET = 10;

  if (filtered.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center shadow-md">
        <p className="text-5xl mb-3">🔍</p>
        <p className="text-lg font-bold text-gray-500">No exposure data yet</p>
        <p className="text-gray-400 mt-1">Start viewing letters to track progress!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl p-4 shadow-md mb-4">
        <p className="text-lg font-bold text-purple-800 text-center">
          📖 {filtered.length} / 26 Letters Viewed
        </p>
      </div>
      {filtered
        .sort((a, b) => a.letter.localeCompare(b.letter))
        .map((item) => {
          const progress = Math.min(item.exposureCount / TARGET, 1);
          const remaining = Math.max(TARGET - item.exposureCount, 0);
          const complete = item.exposureCount >= TARGET;

          return (
            <div key={item.letter} className="bg-white rounded-2xl p-4 shadow-md">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-2xl font-black text-purple-700">
                    {item.letter}
                  </span>
                  <div>
                    <p className="font-bold text-gray-800">
                      {item.exposureCount} / {TARGET} exposures
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatTime(item.totalViewTimeMs)} total · Last: {formatDate(item.lastViewed ? new Date(item.lastViewed) : undefined)}
                    </p>
                  </div>
                </div>
                {complete && <span className="text-2xl">✅</span>}
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    complete ? 'bg-green-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              {!complete && (
                <p className="text-xs text-purple-500 font-semibold mt-1 text-right">
                  {remaining} more to reach target
                </p>
              )}
            </div>
          );
        })}
    </div>
  );
}

/* ─── Tab 2: Interaction ─── */
function InteractionTab({ report }: { report: ReportData }) {
  const { interactionHistory, overallAccuracy } = report;

  const totalAttempts = interactionHistory.reduce((s, h) => s + h.totalAttempts, 0);
  const totalSuccess = interactionHistory.reduce((s, h) => s + h.successfulClicks, 0);
  const currentRate = totalAttempts > 0 ? (totalSuccess / totalAttempts) * 100 : 0;
  const avgResponseTime =
    interactionHistory.length > 0
      ? interactionHistory.reduce((s, h) => s + h.averageResponseTimeMs, 0) / interactionHistory.length
      : 0;
  const consistency = currentRate > 80 ? 'Good' : currentRate > 60 ? 'Fair' : 'Needs Practice';
  const consistencyColor = currentRate > 80 ? 'text-green-600' : currentRate > 60 ? 'text-orange-500' : 'text-red-500';

  const rateColor = currentRate >= 80 ? 'bg-green-500' : currentRate >= 60 ? 'bg-orange-400' : 'bg-red-500';

  // Last 7 days of sessions
  const now = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const sessionsByDate: Record<string, InteractionSession[]> = {};
  interactionHistory.forEach((s) => {
    const dateStr = new Date(s.sessionDate).toISOString().split('T')[0];
    if (!sessionsByDate[dateStr]) sessionsByDate[dateStr] = [];
    sessionsByDate[dateStr].push(s);
  });

  const dailyStats = last7.map((date) => {
    const sessions = sessionsByDate[date] || [];
    const attempts = sessions.reduce((s, h) => s + h.totalAttempts, 0);
    const success = sessions.reduce((s, h) => s + h.successfulClicks, 0);
    return { date, attempts, success, rate: attempts > 0 ? (success / attempts) * 100 : 0 };
  });

  const maxAttempts = Math.max(...dailyStats.map((d) => d.attempts), 1);
  const completionCount = report.exposureData.filter((d) => d.exposureCount >= 10).length;

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard emoji="🔤" label="Alphabet Completion" value={`${completionCount} / 26`} />
        <StatCard emoji="🎯" label="Overall Accuracy" value={`${overallAccuracy.toFixed(1)}%`} />
        <StatCard emoji="⏱️" label="Avg Response" value={formatTime(avgResponseTime)} />
        <div className="bg-white rounded-2xl p-4 shadow-md text-center">
          <p className="text-2xl mb-1">🤝</p>
          <p className={`text-xl font-black ${consistencyColor}`}>{consistency}</p>
          <p className="text-xs text-gray-400 font-semibold">Consistency</p>
        </div>
      </div>

      {/* Success Rate Bar */}
      <div className="bg-white rounded-2xl p-5 shadow-md">
        <p className="font-bold text-gray-700 mb-2">Current Success Rate</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${rateColor} transition-all`} style={{ width: `${currentRate}%` }} />
          </div>
          <span className="font-black text-lg text-gray-800">{currentRate.toFixed(0)}%</span>
        </div>
      </div>

      {/* Session History */}
      <div className="bg-white rounded-2xl p-5 shadow-md">
        <p className="font-bold text-gray-700 mb-4">📅 Last 7 Days</p>
        <div className="flex items-end gap-2 h-32">
          {dailyStats.map((day) => {
            const height = day.attempts > 0 ? (day.attempts / maxAttempts) * 100 : 4;
            const barColor = day.rate >= 80 ? 'bg-green-400' : day.rate >= 60 ? 'bg-orange-400' : day.attempts > 0 ? 'bg-red-400' : 'bg-gray-200';
            const dayLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });

            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-gray-500">
                  {day.attempts > 0 ? `${day.rate.toFixed(0)}%` : ''}
                </span>
                <div className="w-full flex items-end" style={{ height: '80px' }}>
                  <div
                    className={`w-full rounded-t-lg ${barColor} transition-all`}
                    style={{ height: `${height}%`, minHeight: '3px' }}
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-400">{dayLabel}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-md text-center">
      <p className="text-2xl mb-1">{emoji}</p>
      <p className="text-xl font-black text-gray-800">{value}</p>
      <p className="text-xs text-gray-400 font-semibold">{label}</p>
    </div>
  );
}

/* ─── Tab 3: Mastery ─── */
function MasteryTab({
  report,
  selectedLetter,
  onSelectLetter,
}: {
  report: ReportData;
  selectedLetter: LetterMastery | null;
  onSelectLetter: (l: LetterMastery | null) => void;
}) {
  const masteryMap: Record<string, LetterMastery> = {};
  report.masteryData.forEach((m) => {
    masteryMap[m.letter.toUpperCase()] = m;
  });

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-white rounded-2xl p-5 shadow-md text-center">
        <p className="text-lg font-bold text-purple-800 mb-1">🏆 Progress Summary</p>
        <p className="text-3xl font-black text-gray-800">
          {report.lettersStarted} <span className="text-base font-bold text-gray-400">/ 26 Started</span>
        </p>
        <p className="text-purple-600 font-bold mt-1">
          ⭐ {report.lettersMastered} Letters Mastered
        </p>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-2xl p-4 shadow-md">
        <p className="font-bold text-gray-600 text-sm mb-3">Legend</p>
        <div className="flex flex-wrap gap-2">
          {MASTERY_LEVELS.map((level) => (
            <div key={level.label} className="flex items-center gap-1.5">
              <div className={`w-4 h-4 rounded ${level.color}`} />
              <span className="text-xs font-semibold text-gray-500">{level.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Letter Grid */}
      <div className="bg-white rounded-2xl p-4 shadow-md">
        <div className="grid grid-cols-7 gap-2">
          {ALPHABET.map((letter) => {
            const mastery = masteryMap[letter];
            const level = mastery?.masteryLevel ?? 0;
            const style = MASTERY_LEVELS[level];

            return (
              <button
                key={letter}
                onClick={() => mastery && onSelectLetter(mastery)}
                className={`aspect-square rounded-xl flex items-center justify-center text-lg font-black ${style.color} ${style.text} transition-transform hover:scale-110 active:scale-95 ${
                  mastery ? 'cursor-pointer shadow-sm' : 'cursor-default'
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail Popup */}
      {selectedLetter && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => onSelectLetter(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div
                className={`w-20 h-20 rounded-2xl ${MASTERY_LEVELS[selectedLetter.masteryLevel].color} ${MASTERY_LEVELS[selectedLetter.masteryLevel].text} flex items-center justify-center text-4xl font-black mx-auto mb-3`}
              >
                {selectedLetter.letter.toUpperCase()}
              </div>
              <p className="text-xl font-black text-gray-800">
                {MASTERY_LEVELS[selectedLetter.masteryLevel].label}
              </p>
            </div>

            <div className="space-y-3">
              <DetailRow label="Attempts" value={`${selectedLetter.attempts}`} />
              <DetailRow
                label="Correct"
                value={`${selectedLetter.correctAttempts} (${
                  selectedLetter.attempts > 0
                    ? ((selectedLetter.correctAttempts / selectedLetter.attempts) * 100).toFixed(0)
                    : 0
                }%)`}
              />
              <DetailRow label="Last Practiced" value={formatDate(selectedLetter.lastAttempt ? new Date(selectedLetter.lastAttempt) : undefined)} />
            </div>

            <button
              onClick={() => onSelectLetter(null)}
              className="mt-5 w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100">
      <span className="text-gray-500 font-semibold">{label}</span>
      <span className="font-bold text-gray-800">{value}</span>
    </div>
  );
}

/* ─── Tab 4: Numbers ─── */
function NumbersTab({ data, maxCount }: { data: NumberMastery[]; maxCount: number }) {
  const all = Array.from({ length: maxCount }, (_, i) => i + 1);
  const started = data.filter((m) => m.attempts > 0);
  const mastered = data.filter((m) => m.masteryLevel >= 4);
  const totalAttempts = data.reduce((s, m) => s + m.attempts, 0);
  const totalCorrect = data.reduce((s, m) => s + m.correctAttempts, 0);
  const accuracy = totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0;

  if (started.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center shadow-md">
        <p className="text-5xl mb-3">🔢</p>
        <p className="text-lg font-bold text-gray-500">No counting yet</p>
        <p className="text-gray-400 mt-1">
          Try Count With Me — it works with the photos you already added.
        </p>
        <a href="/play/countwithme/" className="btn-kid bg-amber-500 inline-block mt-4 text-base">
          👀 Start counting
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard emoji="🔢" label="Practised" value={`${started.length}/${maxCount}`} />
        <StatCard emoji="⭐" label="Mastered" value={`${mastered.length}`} />
        <StatCard emoji="🎯" label="Accuracy" value={`${Math.round(accuracy)}%`} />
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-md">
        <p className="text-sm text-gray-400 mb-3">
          Counting to {maxCount}. Mastery here means picking the right number after counting a set —
          not just saying the number words in order.
        </p>
        <div className="space-y-3">
          {all.map((value) => {
            const m = data.find((d) => d.number === value);
            const level = m?.masteryLevel ?? 0;
            const attempts = m?.attempts ?? 0;
            const label = MASTERY_LEVELS[level] ?? MASTERY_LEVELS[0];

            return (
              <div key={value} className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl font-black text-amber-700 flex-none">
                  {value}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${label.color} ${label.text}`}>
                      {label.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {attempts > 0 ? `${m!.correctAttempts}/${attempts} right` : 'not tried'}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${level >= 4 ? 'bg-green-500' : 'bg-amber-500'}`}
                      style={{ width: `${(level / 5) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
