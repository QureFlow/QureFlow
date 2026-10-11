import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { announceClinic, prepareClinicAudio, stopClinicAnnouncements } from '../src/lib/clinicAnnouncements';

const originalWindow = globalThis.window;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
let voices: any[];
let spoken: any[];
let errors: string[];
let listeners: Map<string, () => void>;
let timers: Map<number, { callback: () => void; delay: number }>;
let synth: any;
let resumed: number;

beforeEach(() => {
  voices = [{ lang: 'en-US', localService: true, default: true }];
  spoken = [];
  errors = [];
  listeners = new Map();
  timers = new Map();
  resumed = 0;
  let nextTimer = 0;
  globalThis.setTimeout = ((callback: () => void, delay: number) => {
    const id = ++nextTimer;
    timers.set(id, { callback, delay });
    return id;
  }) as any;
  globalThis.clearTimeout = ((id: number) => timers.delete(id)) as any;
  synth = {
    paused: false, speaking: false, pending: false,
    getVoices: () => voices,
    addEventListener: (event: string, callback: () => void) => listeners.set(event, callback),
    removeEventListener: (event: string) => listeners.delete(event),
    resume: () => { synth.paused = false; },
    cancel: () => { synth.speaking = false; synth.pending = false; },
    speak: (utterance: any) => { spoken.push(utterance); synth.pending = true; },
  };
  globalThis.window = {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: class { constructor(public text: string) {} },
    AudioContext: class {
      state = 'suspended';
      resume() { resumed++; this.state = 'running'; return Promise.resolve(); }
    },
  } as any;
});

afterEach(() => {
  stopClinicAnnouncements();
  globalThis.window = originalWindow;
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
});

const announce = () => announceClinic('Token A 0 0 3, please proceed to room 101.', (error) => errors.push(error));
const expire = (delay: number) => {
  for (const [id, timer] of [...timers]) {
    if (timer.delay === delay) { timers.delete(id); timer.callback(); }
  }
};

test('resumes audio during the click and speaks immediately with an installed English voice', () => {
  prepareClinicAudio();
  assert.equal(resumed, 1);
  voices.unshift({ lang: 'en-IN', localService: false, default: false });
  announce();
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].voice.localService, true);
  assert.equal(spoken[0].volume, 1);
  assert.equal(errors.length, 0);
});

test('waits for asynchronously loaded voices and removes its listener', () => {
  voices = [];
  announce();
  assert.equal(spoken.length, 0);
  voices = [{ lang: 'en-IN', localService: true }];
  listeners.get('voiceschanged')!();
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].lang, 'en-IN');
  assert.equal(listeners.size, 0);
});

test('reports a missing speech engine rather than silently succeeding', () => {
  (window as any).speechSynthesis = undefined;
  announce();
  assert.match(errors[0], /unavailable/);
});

test('reports a device with no available voices', () => {
  voices = [];
  announce();
  expire(2000);
  assert.equal(spoken.length, 0);
  assert.match(errors[0], /No speaking voice/);
  assert.equal(listeners.size, 0);
});

test('reports blocked playback independently of queue mutations', () => {
  announce();
  spoken[0].onerror({ error: 'not-allowed' });
  assert.match(errors[0], /blocked.*Test voice/);
  assert.equal(timers.size, 0);
});

test('detects a speech engine that never starts playback', () => {
  announce();
  expire(8000);
  assert.match(errors[0], /did not start/);
  assert.equal(synth.pending, false);
});

test('does not report a timeout after speech starts', () => {
  announce();
  spoken[0].onstart();
  expire(8000);
  assert.deepEqual(errors, []);
  spoken[0].onend();
  assert.equal(timers.size, 0);
});

test('replaying replaces the previous utterance without reporting intentional cancellation', () => {
  announce();
  const previous = spoken[0];
  announce();
  assert.equal(previous.onerror, null);
  assert.equal(spoken.length, 2);
  assert.deepEqual(errors, []);
});

test('handles a synthesis exception and still offers a retry', () => {
  synth.speak = () => { throw new Error('Audio device unavailable'); };
  announce();
  assert.match(errors[0], /could not play.*Test voice/);
});

test('signing out cancels a delayed announcement before voices become available', () => {
  voices = [];
  announce();
  stopClinicAnnouncements();
  voices = [{ lang: 'en-IN', localService: true }];
  assert.equal(listeners.size, 0);
  expire(2000);
  assert.equal(spoken.length, 0);
  assert.deepEqual(errors, []);
});
