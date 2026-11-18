# Pragati 2027 Frontend

A standalone, single-screen teaser frontend for Pragati 2027. It reuses only
the Pragati logo from the 2025 frontend. The email form is visual-only for now:
it validates addresses in the browser but does not save or send them.

The optional instrumental loop is an original piano-like arpeggio with a soft
chord progression and reverb, generated locally with the Web Audio API. It
starts only after the visitor enables music and does not load an audio service
or third-party track.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Countdown

The target is configured in `app/page.jsx` as December 13, 2026 at 00:00 India
Standard Time. Update the `REVEAL_AT` value there when the reveal time is
confirmed. At zero, the countdown is replaced with a reveal message.

## Hero video

The hero uses a locally hosted, muted, looping 720p stock video. Visitors who
prefer reduced motion see its poster image instead.

- Clip: [Abstract red fabric flowing](https://mixkit.co/free-stock-video/abstract-red-fabric-flowing-282/)
- License: [Mixkit Stock Video Free License](https://mixkit.co/license/#videoFree)
