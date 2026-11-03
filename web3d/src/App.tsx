import { Component, useEffect, useState, type ReactNode } from "react";
import { Scene } from "./Scene";
import { CinematicHUD } from "./Cinematic";
import { embed, request, useSession } from "./session";
import { useView } from "./store";
import { WindowMark, Icon } from "./icons";
import { S, V } from "./strings";
import {
  effectiveExpenses,
  money,
  statusColors,
  totalExpenses,
} from "./domain";
import "./style.css";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="canvas-error">
        <h2>{S.error}</h2>
        <p>{S.webgl}</p>
        <button onClick={() => location.reload()}>{S.retry}</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Photo({ path, token }: { path: string; token: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true,
      blobURL = "";
    fetch("/api" + path, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.blob();
      })
      .then((b) => {
        blobURL = URL.createObjectURL(b);
        if (alive) setUrl(blobURL);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (blobURL) URL.revokeObjectURL(blobURL);
    };
  }, [path, token]);
  return url ? (
    <img src={url} alt={S.receipt} />
  ) : (
    <div className="photo-placeholder">{S.loading}</div>
  );
}

export default function App() {
  const { token, setToken } = useSession(),
    view = useView();
  const [phone, setPhone] = useState("+77000000012"),
    [code, setCode] = useState("1234"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [signIn, setSignIn] = useState(false);
  const snapshot = view.snapshot,
    issue = snapshot?.issues.find((i) => i.id === view.selected),
    report = snapshot?.reports.find((r) => r.month === view.month),
    totals = report ? totalExpenses(effectiveExpenses(report)) : 0,
    compact =
      embed === "resident" ||
      new URLSearchParams(location.search).get("mini") === "1";
  const open =
      snapshot?.issues.filter((i) => i.status !== "Resolved").length ?? 0,
    resolved =
      snapshot?.issues.filter((i) => i.status === "Resolved").length ?? 0;
  useEffect(() => {
    if (new URLSearchParams(location.search).get("story") === "1")
      view.set({
        cinematic: true,
        time: 0,
        playing: true,
        night: true,
        winter: true,
      });
  }, []);
  const startFilm = () => {
    setSignIn(false);
    view.set({
      cinematic: true,
      playing: true,
      time: 0,
      selected: null,
      focus: null,
      night: true,
      winter: true,
    });
  };
  useEffect(() => {
    if (!signIn) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSignIn(false);
        return;
      }
      if (event.key === "Tab") {
        const fields = [
          ...document.querySelectorAll<HTMLElement>(
            ".login-card button:not(:disabled),.login-card input",
          ),
        ];
        const first = fields[0],
          last = fields[fields.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.querySelector<HTMLElement>(".enter-link")?.focus();
    };
  }, [signIn]);
  async function login() {
    setBusy(true);
    setError("");
    try {
      try {
        await request("/auth/otp", "", { phone });
      } catch (e) {
        if ((e as { status?: number }).status !== 429) throw e;
      }
      const v = await request("/auth/verify", "", { phone, code });
      setToken(v.token);
      setSignIn(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      className={`world ${view.night ? "night" : ""} ${compact ? "compact" : ""} ${view.cinematic ? "cinematic" : ""} ${view.money ? "money-view" : ""} ${!token ? "arrival" : ""}`}
    >
      <Boundary>
        <Scene />
      </Boundary>
      <div className="stage-shade" aria-hidden="true" />
      {!compact && (
        <header className="world-header">
          <a className="wordmark" href="/" aria-label="Ortaq home">
            <WindowMark />
            {S.brand}
            <span>{V.edition}</span>
          </a>
          <div className="header-location">
            <span>
              {view.cinematic
                ? V.address
                : (snapshot?.building.address ?? V.address)}
            </span>
            <span>
              {view.night
                ? view.winter
                  ? V.winterPlace
                  : V.summerPlace
                : view.winter
                  ? V.winterDay
                  : V.summerDay}
            </span>
          </div>
          {token ? (
            <div className="live-indicator" role="status">
              <i className={view.connected ? "" : "offline"} />
              {view.connected ? V.live : snapshot ? S.offline : S.loading}
            </div>
          ) : (
            !embed && (
              <button className="enter-link" onClick={() => setSignIn(true)}>
                {V.enter}
                <Icon name="arrow" />
              </button>
            )
          )}
        </header>
      )}
      {!view.cinematic && !compact && (
        <>
          <section className="scene-title">
            <h1>
              {view.money && token ? V.moneyTitleFirst : V.titleFirst}
              <br />
              {view.money && token ? V.moneyTitleSecond : V.titleSecond}
            </h1>
            <p>
              {view.money && token
                ? V.moneyDescription
                : token
                  ? V.liveDescription
                  : V.introduction}
            </p>
            <div
              className={`stage-actions ${view.money && token ? "in-money-view" : ""}`}
            >
              <button className="story-button" onClick={startFilm}>
                <span className="play-disc">
                  <Icon name="play" />
                </span>
                <span>
                  {V.watch}
                  <small>{V.filmLength}</small>
                </span>
              </button>
              {!token && !embed && (
                <button className="live-link" onClick={() => setSignIn(true)}>
                  {V.explore}
                  <Icon name="arrow" />
                </button>
              )}
            </div>
            <div className="stage-dedication">
              <span className="tiny-window" />
              {V.dedication}
            </div>
          </section>
          <nav className="scene-tools" data-ui aria-label={V.settings}>
            <button onClick={() => view.set({ winter: !view.winter })}>
              <Icon name={view.winter ? "snow" : "sun"} />
              {view.winter ? S.winter : S.summer}
            </button>
            <button onClick={() => view.set({ night: !view.night })}>
              <Icon name={view.night ? "moon" : "sun"} />
              {view.night ? V.evening : S.day}
            </button>
            <button onClick={() => view.set({ quality: !view.quality })}>
              {view.quality ? S.high : S.low}
            </button>
            {token && (
              <button
                className={view.money ? "selected-tool" : ""}
                onClick={() =>
                  view.set({ money: !view.money, focus: null, selected: null })
                }
              >
                {V.moneyView}
              </button>
            )}
            {embed === "admin" && snapshot?.role === "chairman" && (
              <button
                className={view.balances ? "selected-tool" : ""}
                onClick={() => view.set({ balances: !view.balances })}
              >
                {S.balances}
              </button>
            )}
          </nav>
          {view.focus !== null && (
            <aside className="apartment-note" data-ui>
              <button
                className="icon-button"
                aria-label={S.close}
                onClick={() => view.set({ focus: null })}
              >
                <Icon name="close" />
              </button>
              <WindowMark />
              <h2>
                {V.apartment} {view.focus}
              </h2>
              <p>{view.focus === 45 ? V.apartment45 : V.apartmentOther}</p>
              {view.focus === 45 && (
                <button className="text-button" onClick={startFilm}>
                  {V.followStory}
                  <Icon name="arrow" />
                </button>
              )}
            </aside>
          )}
          {token && snapshot && (
            <aside
              className={`right-panel ${issue ? "has-selection" : ""}`}
              data-ui
            >
              <div className="panel-header">
                <span>{issue ? V.issueStory : V.journal}</span>
                {issue ? (
                  <button
                    className="icon-button"
                    aria-label={S.close}
                    onClick={() => view.set({ selected: null })}
                  >
                    <Icon name="close" />
                  </button>
                ) : (
                  <span className="journal-dot" />
                )}
              </div>
              {issue ? (
                <>
                  <div
                    className="status"
                    style={{ color: statusColors[issue.status] }}
                  >
                    <i />
                    {issue.status}
                  </div>
                  <h2>{issue.title}</h2>
                  <p>
                    {issue.location.area ||
                      `${S.entrance} ${issue.location.entrance} · ${S.floor} ${issue.location.floor}`}{" "}
                    · {issue.category}
                  </p>
                  <Photo path={issue.photo} token={token} />
                  <p>{issue.description}</p>
                  <p className="support-count">
                    {issue.supporters.length} {S.support}
                  </p>
                  {issue.contractor && (
                    <div className="contractor">
                      {S.assigned}
                      <b>{issue.contractor}</b>
                    </div>
                  )}
                  <h3>{S.history}</h3>
                  <ol className="history">
                    {issue.history.map((h, i) => (
                      <li
                        key={i}
                        style={
                          {
                            "--dot": statusColors[h.status],
                          } as React.CSSProperties
                        }
                      >
                        <b>{h.status}</b>
                        <span>{h.note}</span>
                        <time>{new Date(h.at).toLocaleString("en-GB")}</time>
                      </li>
                    ))}
                  </ol>
                  {issue.result_photo && (
                    <>
                      <h3>{S.result}</h3>
                      <Photo path={issue.result_photo} token={token} />
                    </>
                  )}
                </>
              ) : (
                <>
                  <h2>{V.journalTitle}</h2>
                  <div className="journal-summary">
                    <b>{open}</b>
                    <span>{V.needsCare}</span>
                    <b>{resolved}</b>
                    <span>{V.takenCare}</span>
                  </div>
                  <div className="issue-list">
                    {snapshot?.issues.slice(0, 4).map((i) => (
                      <button
                        key={i.id}
                        className="issue-row"
                        onClick={() =>
                          view.set({
                            selected: i.id,
                            focus: null,
                            money: false,
                          })
                        }
                      >
                        <i style={{ background: statusColors[i.status] }} />
                        <span>
                          <b>{i.title}</b>
                          <small>
                            {i.location.area ||
                              `${S.entrance} ${i.location.entrance} · ${S.floor} ${i.location.floor}`}
                          </small>
                        </span>
                        <Icon name="arrow" />
                      </button>
                    ))}
                  </div>
                  <div className="mini-poll">
                    <span>{S.advisory}</span>
                    <h3>{snapshot?.polls[0]?.question}</h3>
                    <div className="progress-track">
                      <div
                        style={{
                          transform: `scaleX(${(snapshot?.polls[0]?.total_votes ?? 0) / 120})`,
                        }}
                      />
                    </div>
                    <p>
                      {snapshot?.polls[0]?.total_votes ?? 0} / 120 {S.voted}
                    </p>
                    <small>{S.sealed}</small>
                  </div>
                </>
              )}
            </aside>
          )}
          <footer className="scene-bottom">
            {token ? (
              <section className="finance-dock" data-ui>
                <button
                  className="fund-toggle"
                  onClick={() =>
                    view.set({
                      money: !view.money,
                      focus: null,
                      selected: null,
                    })
                  }
                >
                  <WindowMark />
                  <span>
                    <small>{V.fundLabel}</small>
                    <strong>{snapshot ? money(totals) : "—"}</strong>
                  </span>
                  <Icon name="arrow" />
                </button>
                <label className="month-select">
                  <span>{S.month}</span>
                  <select
                    aria-label={S.month}
                    value={view.month}
                    onChange={(e) =>
                      view.set({ month: e.target.value, money: true })
                    }
                  >
                    {snapshot?.reports.map((r) => (
                      <option key={r.id}>{r.month}</option>
                    ))}
                  </select>
                </label>
                <div className="receipt-count">
                  <b>{report ? effectiveExpenses(report).length : 0}</b>
                  <span>{V.receiptsCopy}</span>
                </div>
              </section>
            ) : (
              <div className="arrival-proof">
                <b>120</b>
                <span>{V.homes}</span>
                <b>3</b>
                <span>{V.entrances}</span>
                <b>1</b>
                <span>{V.sharedHome}</span>
              </div>
            )}
            <div className="scene-footnote">
              <span>
                {token ? (
                  S.drag
                ) : (
                  <label className="window-picker">
                    {V.pickWindow}
                    <select
                      aria-label={V.pickWindow}
                      value={view.focus ?? ""}
                      onChange={(e) =>
                        view.set({
                          focus: e.target.value ? Number(e.target.value) : null,
                          selected: null,
                        })
                      }
                    >
                      <option value="">{V.pickPrompt}</option>
                      {Array.from({ length: 120 }, (_, i) => (
                        <option key={i} value={i + 1}>
                          {V.apartment} {i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </span>
              {token && (
                <div className="legend" data-ui>
                  {(["New", "In Progress", "Resolved"] as const).map(
                    (status) => (
                      <span key={status}>
                        <i style={{ background: statusColors[status] }} />
                        {status}
                      </span>
                    ),
                  )}
                </div>
              )}
              <span>{V.signature}</span>
            </div>
          </footer>
        </>
      )}
      {view.cinematic && <CinematicHUD />}
      {compact && (
        <>
          <div className="compact-label">
            <i className={view.connected ? "" : "offline"} />
            {view.connected
              ? snapshot?.apartment
                ? `${S.compactLive} ${snapshot.apartment}`
                : V.sharedLive
              : V.connecting}
          </div>
          <div className="compact-caption">
            {V.compactCaption}
            <Icon name="arrow" />
          </div>
        </>
      )}
      {!token && embed && !view.cinematic && (
        <div className="connection-note">
          <WindowMark />
          <span>{S.loading}</span>
        </div>
      )}
      {signIn && !embed && !view.cinematic && (
        <div className="signin-layer" onClick={() => setSignIn(false)}>
          <form
            className="login-card"
            data-ui
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              login();
            }}
          >
            <button
              className="icon-button close-signin"
              type="button"
              aria-label={S.close}
              onClick={() => setSignIn(false)}
            >
              <Icon name="close" />
            </button>
            <WindowMark />
            <h2 id="login-title">{V.welcome}</h2>
            <p>{V.loginCopy}</p>
            <label>
              {S.phone}
              <input
                autoFocus
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                pattern="\+7[0-9]{10}"
              />
            </label>
            <label>
              {S.code}
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={4}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? S.loading : V.enterHome}
              <Icon name="arrow" />
            </button>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <small>{S.demo}</small>
            <p className="privacy">{S.privacy}</p>
          </form>
        </div>
      )}
    </main>
  );
}
