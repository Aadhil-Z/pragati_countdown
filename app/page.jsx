"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const REVEAL_AT = Date.parse("2026-12-13T00:00:00+05:30");
const VIDEO_PLAYBACK_RATE = 0.7;
const TIME_UNITS = [
  ["days", 24 * 60 * 60 * 1000],
  ["hours", 60 * 60 * 1000],
  ["minutes", 60 * 1000],
  ["seconds", 1000],
];

function getTimeLeft(now) {
  let remaining = Math.max(0, REVEAL_AT - now);

  return TIME_UNITS.map(([label, duration]) => {
    const value = Math.floor(remaining / duration);
    remaining %= duration;
    return { label, value: String(value).padStart(2, "0") };
  });
}

export default function Home() {
  const [timeLeft, setTimeLeft] = useState(null);
  const [playVideo, setPlayVideo] = useState(false);
  const [videoFading, setVideoFading] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [email, setEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const audioContextRef = useRef(null);
  const audioSchedulerRef = useRef(null);
  const fadeTimeoutRef = useRef(null);

  useEffect(() => {
    const updateCountdown = () => setTimeLeft(getTimeLeft(Date.now()));
    updateCountdown();

    const timerId = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateVideoPreference = () => {
      setPlayVideo(!motionPreference.matches);
    };

    updateVideoPreference();
    motionPreference.addEventListener("change", updateVideoPreference);
    return () => {
      motionPreference.removeEventListener("change", updateVideoPreference);
      if (fadeTimeoutRef.current) window.clearTimeout(fadeTimeoutRef.current);
      if (audioSchedulerRef.current) {
        window.clearInterval(audioSchedulerRef.current);
      }
      if (audioContextRef.current) void audioContextRef.current.close();
    };
  }, []);

  const revealReached =
    timeLeft !== null && timeLeft.every(({ value }) => value === "00");

  async function toggleAudio() {
    setAudioError("");

    if (audioContextRef.current) {
      const context = audioContextRef.current;
      if (audioSchedulerRef.current) {
        window.clearInterval(audioSchedulerRef.current);
        audioSchedulerRef.current = null;
      }
      audioContextRef.current = null;
      await context.close();
      setAudioEnabled(false);
      return;
    }

    try {
      const AudioContextConstructor =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) {
        throw new Error("Audio playback is not supported by this browser.");
      }

      const context = new AudioContextConstructor();
      audioContextRef.current = context;
      const resumeAudio = context.resume();
      const master = context.createGain();
      master.gain.setValueAtTime(0, context.currentTime);
      master.gain.linearRampToValueAtTime(0.62, context.currentTime + 1.2);

      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 18;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.25;
      master.connect(compressor);
      compressor.connect(context.destination);

      const reverbBuffer = context.createBuffer(
        2,
        Math.floor(context.sampleRate * 1.8),
        context.sampleRate,
      );
      for (let channel = 0; channel < reverbBuffer.numberOfChannels; channel += 1) {
        const samples = reverbBuffer.getChannelData(channel);
        for (let index = 0; index < samples.length; index += 1) {
          const decay = 1 - index / samples.length;
          samples[index] = (Math.random() * 2 - 1) * decay ** 2.8;
        }
      }
      const convolver = context.createConvolver();
      convolver.buffer = reverbBuffer;
      const reverbGain = context.createGain();
      reverbGain.gain.value = 0.19;
      convolver.connect(reverbGain);
      reverbGain.connect(compressor);

      const progression = [
        { root: 45, notes: [57, 64, 69, 72, 76, 72, 69, 64] },
        { root: 41, notes: [53, 60, 65, 69, 72, 69, 65, 60] },
        { root: 48, notes: [60, 67, 72, 76, 79, 76, 72, 67] },
        { root: 43, notes: [55, 62, 67, 71, 74, 71, 67, 62] },
      ];

      const playNote = (midiNote, when, velocity = 1) => {
        const frequency = 440 * 2 ** ((midiNote - 69) / 12);
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(2600, when);
        filter.frequency.exponentialRampToValueAtTime(900, when + 1.15);
        filter.connect(master);
        filter.connect(convolver);

        const fundamental = context.createOscillator();
        const fundamentalGain = context.createGain();
        fundamental.type = "sine";
        fundamental.frequency.setValueAtTime(frequency, when);
        fundamentalGain.gain.setValueAtTime(0.0001, when);
        fundamentalGain.gain.linearRampToValueAtTime(0.3 * velocity, when + 0.012);
        fundamentalGain.gain.exponentialRampToValueAtTime(0.001, when + 1.25);
        fundamental.connect(fundamentalGain);
        fundamentalGain.connect(filter);
        fundamental.start(when);
        fundamental.stop(when + 1.3);

        const overtone = context.createOscillator();
        const overtoneGain = context.createGain();
        overtone.type = "triangle";
        overtone.frequency.setValueAtTime(frequency * 2, when);
        overtoneGain.gain.setValueAtTime(0.0001, when);
        overtoneGain.gain.linearRampToValueAtTime(0.075 * velocity, when + 0.01);
        overtoneGain.gain.exponentialRampToValueAtTime(0.001, when + 0.58);
        overtone.connect(overtoneGain);
        overtoneGain.connect(filter);
        overtone.start(when);
        overtone.stop(when + 1.3);

        overtone.onended = () => {
          fundamental.disconnect();
          fundamentalGain.disconnect();
          overtone.disconnect();
          overtoneGain.disconnect();
          filter.disconnect();
        };
      };

      await resumeAudio;
      if (context.state !== "running") {
        throw new Error("Audio is blocked by the browser. Try enabling sound again.");
      }

      let noteIndex = 0;
      const noteInterval = 60 / 88 / 2;
      let nextNoteAt = context.currentTime + 0.08;
      const scheduleNotes = () => {
        while (nextNoteAt < context.currentTime + 0.14) {
          const bar = progression[Math.floor(noteIndex / 8) % progression.length];
          const step = noteIndex % 8;
          const accent = step === 0 || step === 4 ? 1 : 0.76;
          playNote(bar.notes[step], nextNoteAt, accent);
          if (step === 0) playNote(bar.root, nextNoteAt, 0.62);
          nextNoteAt += noteInterval;
          noteIndex += 1;
        }
      };

      scheduleNotes();
      audioSchedulerRef.current = window.setInterval(scheduleNotes, 35);
      setAudioEnabled(true);
    } catch (error) {
      if (audioSchedulerRef.current) {
        window.clearInterval(audioSchedulerRef.current);
        audioSchedulerRef.current = null;
      }
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setAudioError(
        error instanceof Error ? error.message : "Could not start ambient audio.",
      );
      setAudioEnabled(false);
    }
  }

  function fadeVideoBeforeLoop(event) {
    const video = event.currentTarget;
    if (video.duration && video.currentTime >= video.duration - 1.3) {
      setVideoFading(true);
    }
  }

  function restartVideoInDark(event) {
    const video = event.currentTarget;
    setVideoFading(true);
    video.currentTime = 0;
    video.playbackRate = VIDEO_PLAYBACK_RATE;

    const playback = video.play();
    if (playback) {
      playback
        .then(() => {
          fadeTimeoutRef.current = window.setTimeout(
            () => setVideoFading(false),
            550,
          );
        })
        .catch(() => {
          setPlayVideo(false);
          setVideoFading(false);
        });
    } else {
      setVideoFading(false);
    }
  }

  function handleEmailSubmit(event) {
    event.preventDefault();
    setEmailMessage(
      "Sign-ups are not connected yet, so your email has not been saved.",
    );
  }

  return (
    <main className="page-shell">
      <div className="video-backdrop" aria-hidden="true">
        {playVideo && (
          <video
            className="hero-video"
            autoPlay
            muted
            playsInline
            preload="metadata"
            poster="/videos/flowing-crimson-fabric-poster.jpg"
            onLoadedMetadata={(event) => {
              event.currentTarget.playbackRate = VIDEO_PLAYBACK_RATE;
            }}
            onTimeUpdate={fadeVideoBeforeLoop}
            onEnded={restartVideoInDark}
            onError={() => {
              setPlayVideo(false);
              setVideoFading(false);
            }}
          >
            <source src="/videos/flowing-crimson-fabric.mp4" type="video/mp4" />
          </video>
        )}
      </div>
      <div
        className={`video-loop-fade${videoFading ? " is-dark" : ""}`}
        aria-hidden="true"
      />
      <div className="video-overlay" aria-hidden="true" />

      <button
        className={`audio-toggle${audioEnabled ? " is-playing" : ""}`}
        type="button"
        onClick={toggleAudio}
        aria-pressed={audioEnabled}
        aria-label={audioEnabled ? "Turn instrumental music off" : "Turn instrumental music on"}
      >
        <span className="audio-bars" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
        <span>{audioEnabled ? "MUSIC ON" : "MUSIC OFF"}</span>
      </button>
      {audioError && <p className="audio-error" role="status">{audioError}</p>}

      <section className="hero" aria-labelledby="hero-title">
        <div className="brand-lockup">
          <div className="brand-partners">
            <Image
              src="/pragati-logo.png"
              alt=""
              width={56}
              height={56}
              priority
              className="brand-mark"
            />
            <div className="organizer">
              <Image
                src="/amrita-school-of-business.png"
                alt="Amrita School of Business, Coimbatore"
                width={1258}
                height={249}
                className="organizer-logo"
              />
            </div>
          </div>
          <h1 id="hero-title">PRAGATI</h1>
          <p className="brand-year">2027 <span>·</span> ANNUAL MANAGEMENT FESTIVAL</p>
        </div>

        <p className="hero-subtitle">
          Be the first to know when the next big thing is revealed.
        </p>

        <div className="countdown-wrap">
          <div className="countdown-heading">
            <span className="countdown-signal" />
            <span>COUNTDOWN TO THE REVEAL</span>
            <span className="countdown-signal" />
          </div>

          {revealReached ? (
            <p className="reveal-message" role="status">THE MOMENT IS NOW</p>
          ) : (
            <div
              className="countdown"
              role="timer"
              aria-label="Time remaining until the reveal"
            >
              {(timeLeft ??
                TIME_UNITS.map(([label]) => ({ label, value: "--" }))).map(
                ({ label, value }) => (
                  <div className="time-unit" key={label}>
                    <span className="time-value" key={`${label}-${value}`}>
                      {value}
                    </span>
                    <span className="time-label">{label}</span>
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        <div className="updates">
          <p className="updates-copy">Get the next update in your inbox.</p>
          <form className="updates-form" onSubmit={handleEmailSubmit}>
            <label className="visually-hidden" htmlFor="updates-email">
              Email address
            </label>
            <input
              id="updates-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailMessage("");
              }}
              required
            />
            <button type="submit">KEEP ME POSTED</button>
          </form>
          <p className="updates-note" aria-live="polite">
            {emailMessage || "Only the important stuff. No spam."}
          </p>
        </div>
      </section>
    </main>
  );
}
