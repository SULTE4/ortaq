import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useView } from "./store";
import { Icon } from "./icons";
import { C, S, chapterCopy, chapterShort } from "./strings";
import { chapterAt, duration, scriptVotes, cinematicClock } from "./cinematic";
export function CinematicHUD() {
  const { time, playing, speed, set } = useView();
  const tween = useRef<gsap.core.Tween>();
  const clock = useRef(cinematicClock);
  const chapter = chapterAt(time),
    copy = chapterCopy[chapter];
  useEffect(() => {
    gsap.ticker.lagSmoothing(0);
    clock.current.time = useView.getState().time;
    let last = -1;
    const t = gsap.to(clock.current, {
      time: duration,
      duration: duration,
      ease: "none",
      paused: !useView.getState().playing,
      onUpdate: () => {
        const now = clock.current.time;
        if (Math.floor(now * 10) !== last) {
          last = Math.floor(now * 10);
          useView.getState().set({ time: now });
        }
      },
      onComplete: () =>
        useView.getState().set({ playing: false, time: duration }),
    });
    tween.current = t;
    return () => {
      t.kill();
    };
  }, []);
  useEffect(() => {
    const t = tween.current;
    if (!t) return;
    if (playing && time >= duration) {
      clock.current.time = 0;
      t.invalidate().restart();
      set({ time: 0 });
    } else t.paused(!playing);
  }, [playing]);
  useEffect(() => {
    tween.current?.timeScale(speed);
  }, [speed]);
  useEffect(() => {
    const t = tween.current;
    if (t && Math.abs(clock.current.time - time) > 0.25) {
      clock.current.time = time;
      t.progress(time / duration);
    }
  }, [time]);
  const seek = (v: number) => set({ time: Math.max(0, Math.min(duration, v)) });
  return (
    <>
      <div className="cinema-top">
        <span className="chapter-context">{C.subtitle}</span>
        <button
          className="glass cinema-exit"
          onClick={() =>
            set({ cinematic: false, playing: false, time: 0, selected: null })
          }
        >
          <Icon name="arrow" /> {S.back}
        </button>
      </div>
      <div className="chapter-title" key={chapter}>
        <p className="chapter-context">
          {chapterShort[chapter]} · {C.subtitle}
        </p>
        <h1>{copy.title}</h1>
      </div>
      {time >= 10 && time < 30 && (
        <div className="phone-mock">
          <div className="phone-speaker" />
          <div className="phone-wordmark">
            ortaq <span />
          </div>
          <p className="chapter-context">{C.phoneTitle}</p>
          <h3>{C.phoneIssue}</h3>
          <small>{C.phoneApartment}</small>
          <div className="radiator-photo">
            <div>
              {Array.from({ length: 7 }, (_, i) => (
                <i key={i} />
              ))}
            </div>
            <span>
              <Icon name="snow" />
            </span>
          </div>
          <p>{C.phoneBody}</p>
          <div className="phone-done">
            <Icon name="check" /> {time >= 20 ? C.support : C.submitted}
          </div>
        </div>
      )}
      {time >= 30 && time < 40 && (
        <div className="cinema-fact glass amber">
          <span>
            <Icon name="arrow" />
          </span>
          <div>
            <b>In Progress</b>
            <p>{C.assigned}</p>
          </div>
        </div>
      )}
      {time >= 40 && time < 50 && (
        <div className="cinema-fact glass green">
          <span>
            <Icon name="check" />
          </span>
          <div>
            <b>{C.resolved}</b>
            <p>
              {C.notified} · {C.resultPhoto}
            </p>
            <div className="mini-result-photo">
              {Array.from({ length: 7 }, (_, i) => (
                <i key={i} />
              ))}
            </div>
          </div>
        </div>
      )}
      {time >= 50 && time < 60 && (
        <div className="cinema-fact glass blue">
          <span>
            <Icon name="check" />
          </span>
          <div>
            <b>{C.report}</b>
            <p>{C.receipts}</p>
          </div>
        </div>
      )}
      {time >= 60 && time < 70 && (
        <div className="cinema-fact glass blue">
          <span>
            <Icon name="arrow" />
          </span>
          <div>
            <b>{C.water}</b>
            <p>{C.waterTime}</p>
          </div>
        </div>
      )}
      {time >= 70 && time < 80 && (
        <div className="cinema-poll glass">
          <p className="chapter-context">{C.advisory}</p>
          <h3>{C.poll}</h3>
          <div className="poll-result">
            <span>{C.yes}</span>
            <div>
              <i style={{ width: `${Math.min(68, (time - 70) * 10)}%` }} />
            </div>
            <b>{Math.min(68, Math.floor((time - 70) * 10))}%</b>
          </div>
          <p>
            {scriptVotes(time)} / 100 {S.voted}
          </p>
        </div>
      )}
      <div className="cinema-bottom">
        <p className="subtitle" key={chapter}>
          {copy.caption}
        </p>
        <div className="timeline glass">
          <div className="timeline-top">
            <button
              className="play-control"
              aria-label={playing ? S.pause : S.play}
              onClick={() => set({ playing: !playing })}
            >
              <Icon name={playing ? "pause" : "play"} />
            </button>
            <button
              aria-label={S.previous}
              onClick={() => seek(Math.max(0, chapter - 1) * 10)}
            >
              <Icon name="arrow" />
            </button>
            <button
              aria-label={S.next}
              onClick={() => seek((chapter + 1) * 10)}
            >
              <Icon name="arrow" />
            </button>
            <span className="time-label">
              {Math.floor(time).toString().padStart(2, "0")} <i>/ 90s</i>
            </span>
            <div className="timeline-spacer" />
            <span className="script-note">{S.simulation}</span>
            <button
              className="speed-control"
              aria-label={S.speed}
              onClick={() => set({ speed: speed === 1 ? 2 : 1 })}
            >
              {speed}×
            </button>
          </div>
          <input
            aria-label={C.timeline}
            type="range"
            min="0"
            max="90"
            step=".1"
            value={time}
            onChange={(e) => seek(Number(e.target.value))}
          />
          <div className="chapter-ticks">
            {chapterCopy.map((c, i) => (
              <button
                key={c.title}
                className={chapter === i ? "current" : ""}
                title={c.title}
                onClick={() => seek(i * 10)}
              >
                {chapterShort[i]}
              </button>
            ))}
          </div>
        </div>
        <small>{C.note}</small>
      </div>
    </>
  );
}
