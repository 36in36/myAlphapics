<?php
/**
 * MyAlphaPics TTS proxy — ElevenLabs (Jessica).
 *
 * Generates audio for the phrases that cannot be pre-bundled: custom letter
 * words a parent types, the child's name, and word-bank entries.
 *
 * Deploy to cPanel beside the activation checker. Set ELEVENLABS_API_KEY in
 * the environment (or edit the constant below), and make cache/ writable.
 *
 * Protection matters here: an open TTS proxy is a way to burn the account
 * balance. Three gates — activation code, phrase whitelist, length cap — plus
 * a shared disk cache so a given phrase is only ever generated once for all
 * users combined.
 */

declare(strict_types=1);

const API_KEY   = ''; // leave empty to read ELEVENLABS_API_KEY from the environment
const VOICE_ID  = 'cgSgspJ2msm6clMCkdW9';
const MODEL_ID  = 'eleven_multilingual_v2';
const FORMAT    = 'mp3_44100_64';   // must match scripts/generate-audio.mjs
const CACHE_DIR = __DIR__ . '/cache';
const MAX_CHARS = 120;
const ALLOWED_ORIGIN = 'https://app.myalphapics.com';
const VERIFY_URL = 'https://myalphapics.com/api/verify_code.php';

header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Vary: Origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST')    { fail(405, 'method_not_allowed'); }

function fail(int $code, string $msg): void {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode(['error' => $msg]);
    exit;
}

function normalize(string $t): string {
    // preg_replace returns null on failure; strict_types would reject that in trim().
    return trim(preg_replace('/\s+/u', ' ', $t) ?? $t);
}

/**
 * Only the phrase shapes the app actually speaks. Anything else is rejected,
 * which stops this being usable as a general-purpose TTS API.
 */
function allowed(string $text): bool {
    $patterns = [
        '/^The letter [A-Z], is for .{1,40}$/u',              // custom letter word
        '/^This is the letter .{1,3}$/u',
        '/^This is the letter .{1,3}\. It\'s the \w+ letter in .{1,40}\.$/u',
        '/^The character .{1,3}$/u',
        '/^Can you (find|press) the letter .{1,3}\?$/u',
        '/^(You pressed|Excellent! You pressed) the letter .{1,3}!$/u',
        '/^Hi .{1,30}! (I\'m excited to show you the ABCs!|Let\'s .{1,40})$/u',
        '/^Your name is .{1,30}$/u',
        '/^Let\'s learn the letters in (the word: .{1,30}|your name!)$/u',
        '/^Today we\'re focusing on the letters: [A-Z, ]{1,40}$/u',
        // Celebration phrases — name substituted into a fixed set of templates.
        '/^(Great job|Way to go|Keep it up|Fantastic|Super work|Nice job), .{1,30}!$/u',
        '/^You\'re (doing awesome|a star), .{1,30}!$/u',
        '/^(Wow|Incredible work|What a champion,|Congratulations) .{1,30}[,!].{0,60}$/u',
        '/^.{1,30}, you(\'re a superstar| completed everything)!.{0,30}$/u',
        '/^You did it, .{1,30}! You finished all the letters! Amazing!$/u',
        '/^.{1,30}, now you know all the letters in your name! You\'re doing a great job!$/u',
        '/^Amazing work, .{1,30}! You completed all five levels! You\'re getting so smart!$/u',
        '/^[A-Za-z][A-Za-z\'\-]{0,24}$/u',                    // ONE word-bank word, no spaces
    ];
    foreach ($patterns as $p) { if (preg_match($p, $text)) return true; }
    return false;
}

/**
 * Verifies the 6-digit code against the activation endpoint this app already
 * uses (src/lib/db.ts calls the same URL). Deployed as a sibling in /api/, so
 * this is a same-host call.
 *
 * Fails closed: any error, timeout, or non-true response rejects the request
 * rather than allowing unauthenticated generation against a billed API.
 */
function activation_is_valid(string $code): bool {
    $ch = curl_init(VERIFY_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode(['code' => $code]),
    ]);
    $body   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($status !== 200 || !$body) return false;
    $data = json_decode($body, true);
    return is_array($data) && !empty($data['valid']);   // matches db.ts truthy check
}

$raw  = file_get_contents('php://input');
$body = json_decode($raw ?: '', true);
if (!is_array($body)) fail(400, 'bad_json');

$text = normalize((string)($body['text'] ?? ''));
$code = trim((string)($body['code'] ?? ''));

if ($text === '')                    fail(400, 'empty_text');
if (mb_strlen($text) > MAX_CHARS)    fail(400, 'text_too_long');
if (!preg_match('/^\d{6}$/', $code)) fail(403, 'bad_code');
if (!allowed($text))                 fail(400, 'text_not_allowed');

// Reuse the activation checker so only paying users can reach generation.
if (!activation_is_valid($code)) fail(403, 'bad_code');

$key  = sha1($text);
$file = CACHE_DIR . '/' . $key . '.mp3';

if (!is_dir(CACHE_DIR)) @mkdir(CACHE_DIR, 0755, true);

if (is_file($file) && filesize($file) > 512) {
    header('Content-Type: audio/mpeg');
    header('Content-Length: ' . filesize($file));
    header('X-Cache: HIT');
    readfile($file);
    exit;
}

$apiKey = API_KEY !== '' ? API_KEY : (getenv('ELEVENLABS_API_KEY') ?: '');
if ($apiKey === '') fail(500, 'no_api_key');

$ch = curl_init('https://api.elevenlabs.io/v1/text-to-speech/' . VOICE_ID . '?output_format=' . FORMAT);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => ['xi-api-key: ' . $apiKey, 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS     => json_encode([
        'text'     => $text,
        'model_id' => MODEL_ID,
        'voice_settings' => [
            'stability' => 0.45, 'similarity_boost' => 0.75,
            'style' => 0.15, 'use_speaker_boost' => true,
        ],
    ]),
]);
$audio  = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($status !== 200 || !$audio || strlen($audio) < 512) fail(502, 'upstream_failed');

@file_put_contents($file, $audio);   // shared across every family, generated once

header('Content-Type: audio/mpeg');
header('Content-Length: ' . strlen($audio));
header('X-Cache: MISS');
echo $audio;
