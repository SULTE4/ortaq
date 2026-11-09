import { Component, useEffect, useState, type ReactNode } from "react";
import { Scene } from "./CityMap";
import { ApartmentFloorPlan } from "./ApartmentFloorPlan";
import { modelFor, sauran } from "./buildingModel";
import { CinematicHUD } from "./Cinematic";
import { embed, request, useSession } from "./session";
import { activePalette } from "./palette";
import { useView } from "./store";
import { WindowMark, Icon } from "./icons";
import { S, V } from "./strings";
import {
  categoryColors,
  effectiveExpenses,
  groupExpenses,
  money,
  statusColors,
  totalExpenses,
} from "./domain";
import { Count } from "./Count";
import "./style.css";

function SceneFallback({
  onUnavailable,
  onExplore,
}: {
  onUnavailable: () => void;
  onExplore: () => void;
}) {
  useEffect(onUnavailable, [onUnavailable]);
  return (
    <section className="canvas-error" aria-label={S.error}>
      <svg
        className="fallback-building"
        viewBox="0 0 360 180"
        role="img"
        aria-label="Our shared building"
      >
        <path fill="#3E7484" d="M15 25h330v145H15z" />
        <path fill="#C4CDD6" d="M10 20h340v8H10zM0 170h360v10H0z" />
        {Array.from({ length: 60 }, (_, i) => (
          <rect
            key={i}
            x={28 + (i % 12) * 26}
            y={40 + Math.floor(i / 12) * 23}
            width="13"
            height="14"
            fill={i % 5 ? "#BFD6E4" : "#2B505C"}
          />
        ))}
        {[60, 170, 280].map((x) => (
          <rect key={x} x={x} y="149" width="20" height="21" fill="#2B505C" />
        ))}
      </svg>
      <h2>{S.error}</h2>
      <p>{S.webgl}</p>
      <div className="fallback-actions">
        <button onClick={() => location.reload()}>{S.retry}</button>
        {!embed && <button onClick={onExplore}>{V.explore}</button>}
      </div>
    </section>
  );
}
class Boundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
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
    [signIn, setSignIn] = useState(false),
    [sceneFailed, setSceneFailed] = useState(false),
    [sheetOpen, setSheetOpen] = useState(false),
    [toolsOpen, setToolsOpen] = useState(false);
  useEffect(() => {
    if (!toolsOpen) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest(".scene-tools"))
        setToolsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setToolsOpen(false);
        document
          .querySelector<HTMLButtonElement>(".scene-settings-toggle")
          ?.focus();
      }
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [toolsOpen]);
  const snapshot = view.snapshot,
    building = snapshot?.building ?? view.mapBuilding,
    apartmentCount = building?.apartments ?? null,
    issue = snapshot?.issues.find((i) => i.id === view.selected),
    report = snapshot?.reports.find((r) => r.month === view.month),
    totals = report ? totalExpenses(effectiveExpenses(report)) : 0,
    compact =
      embed === "resident" ||
      new URLSearchParams(location.search).get("mini") === "1";
  const focusedModel = view.focus !== null ? modelFor(building ?? sauran) : null;
  const focusedCell = focusedModel?.cells.find(
    (c) => c.apartment === view.focus,
  );
  useEffect(() => {
    if (view.focus !== null || view.selected || view.money) setSheetOpen(true);
  }, [view.focus, view.selected, view.money]);
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
        night: false,
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
      night: false,
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
  if (embed === "picker")
    return (
      <main
        className="world picker-world"
        style={activePalette.cssVars as React.CSSProperties}
      >
        <Scene picker token={token} />
      </main>
    );
  return (
    <main
      className={`world ${view.night ? "night" : ""} ${compact ? "compact" : ""} ${view.cinematic ? "cinematic" : ""} ${view.money ? "money-view" : ""} ${!token ? "arrival" : "live-view"} ${view.focus !== null || view.selected ? "has-focus" : ""} ${sceneFailed ? "scene-unavailable" : ""}`}
      style={view.night ? undefined : (activePalette.cssVars as React.CSSProperties)}
    >
      <Boundary
        fallback={
          <SceneFallback
            onUnavailable={() => setSceneFailed(true)}
            onExplore={() => setSignIn(true)}
          />
        }
      >
        <Scene token={token} />
      </Boundary>
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
                : (building?.address ?? V.address)}
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
      <div className="view-ui">
        {!view.cinematic && !compact && !sceneFailed && (
          <>
            <section className="scene-title">
              <div className="eyebrow-row">
                {token && snapshot?.apartment
                  ? "ENTRANCE 2 · FLOOR 2 · RESIDENT"
                  : `${building?.address ?? "6 SAURAN ST"} · ASTANA`}
              </div>
              <h1>
                {view.money && token
                  ? `${V.moneyTitleFirst} ${V.moneyTitleSecond}`
                  : token && snapshot
                    ? snapshot.apartment
                      ? `${V.apartment} ${snapshot.apartment}`
                      : V.greetingBuilding
                    : building && !apartmentCount
                      ? "Your building."
                      : "120 homes."}
              </h1>
              <p>
                {view.money && token
                  ? V.moneyDescription
                  : token
                    ? V.liveDescription
                    : building && !apartmentCount
                      ? "Sign in to inspect your building tickets and shared receipts."
                      : V.introduction}
              </p>
              <div
                className={`stage-actions ${view.money && token ? "in-money-view" : ""}`}
              >
                {token && snapshot?.apartment ? (
                  <button
                    className="primary-cta"
                    onClick={() =>
                      view.set({
                        focus: snapshot.apartment,
                        selected: null,
                        money: false,
                      })
                    }
                  >
                    {V.yourWindow}
                    <Icon name="arrow" />
                  </button>
                ) : !token && !embed ? (
                  <button
                    className="primary-cta"
                    onClick={() => setSignIn(true)}
                  >
                    {V.explore}
                    <Icon name="arrow" />
                  </button>
                ) : null}
                <button className="story-button" onClick={startFilm}>
                  <span className="play-disc">
                    <Icon name="play" />
                  </span>
                  <span>
                    {V.watch}
                    <small>{V.filmLength}</small>
                  </span>
                </button>
              </div>
              <div className="stage-dedication">
                <span className="tiny-window" />
                {building
                  ? apartmentCount
                    ? `${building.address} · ${apartmentCount} homes`
                    : `${building.address} · ${building.floors} floors`
                  : V.dedication}
              </div>
            </section>
            <nav
              className={`scene-tools ${toolsOpen ? "is-open" : ""}`}
              data-ui
              aria-label={V.settings}
            >
              <button
                className="scene-settings-toggle"
                aria-expanded={toolsOpen}
                aria-controls="scene-tool-options"
                onClick={() => setToolsOpen(!toolsOpen)}
              >
                <Icon name="settings" />
                {V.sceneSettings}
              </button>
              <div
                id="scene-tool-options"
                className="scene-tool-options"
                onClick={() => setToolsOpen(false)}
              >
                <button onClick={() => view.set({ winter: !view.winter })}>
                  <Icon name={view.winter ? "snow" : "sun"} />
                  {view.winter ? S.winter : S.summer}
                </button>
                <button
                  className={view.night ? "selected-tool" : ""}
                  onClick={() => view.set({ night: !view.night })}
                >
                  <Icon name={view.night ? "moon" : "sun"} />
                  {view.night ? V.evening : S.day}
                </button>
                {token && (
                  <button
                    className={view.money ? "selected-tool" : ""}
                    onClick={() =>
                      view.set({
                        money: !view.money,
                        focus: null,
                        selected: null,
                      })
                    }
                  >
                    {V.moneyView}
                  </button>
                )}
                <button
                  className={view.city ? "selected-tool" : ""}
                  onClick={() =>
                    view.set({
                      city: !view.city,
                      focus: null,
                      selected: null,
                      money: false,
                    })
                  }
                >
                  {view.city ? "Building" : "City view"}
                </button>
                <button
                  onClick={() =>
                    view.set({
                      focus: null,
                      selected: null,
                      money: false,
                      city: false,
                      cameraReset: view.cameraReset + 1,
                    })
                  }
                >
                  {S.reset}
                </button>
                {embed === "admin" && snapshot?.role === "chairman" && (
                  <button
                    className={view.balances ? "selected-tool" : ""}
                    onClick={() => view.set({ balances: !view.balances })}
                  >
                    {S.balances}
                  </button>
                )}
              </div>
            </nav>
            <div
              className={`scene-details ${sheetOpen ? "is-open" : ""}`}
              data-ui
            >
              <button
                className="sheet-toggle"
                aria-expanded={sheetOpen}
                onClick={() => setSheetOpen(!sheetOpen)}
              >
                {sheetOpen ? S.hideDetails : S.showDetails}
              </button>
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
                  {focusedCell && (
                    <>
                      <div className="apartment-facts">
                        <strong>
                          {focusedCell.rooms}{" "}
                          {focusedCell.rooms === 1 ? "room" : "rooms"}
                        </strong>
                        <span>about {Math.round(focusedCell.area)} m2</span>
                      </div>
                      <p className="apartment-location">
                        {S.entrance} {focusedCell.entrance} · {S.floor}{" "}
                        {focusedCell.floor}
                      </p>
                      <ApartmentFloorPlan
                        key={`${building?.id}:${view.focus}:${token}:${JSON.stringify([building?.plan_images, building?.floor_plan, building?.entrance_plans])}`}
                        building={focusedModel!.building}
                        cell={focusedCell}
                        windows={focusedModel!.windows}
                        token={token}
                      />
                    </>
                  )}
                  <p>
                    {view.focus === 45
                      ? V.apartment45
                      : `One of ${building?.apartments ?? 120} homes sharing this building.`}
                  </p>
                  {view.focus === 45 && (
                    <button className="text-button" onClick={startFilm}>
                      {V.followStory}
                      <Icon name="arrow" />
                    </button>
                  )}
                </aside>
              )}
              {token && !snapshot && (
                <aside
                  className="right-panel loading-journal"
                  aria-label="Loading the building journal"
                  aria-busy="true"
                >
                  <div className="skeleton skeleton-heading" />
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="skeleton skeleton-row" />
                  ))}
                </aside>
              )}
              {token && snapshot && view.focus === null && !view.money && (
                <aside
                  key={issue?.id ?? "journal"}
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
                        style={
                          {
                            "--status": statusColors[issue.status],
                          } as React.CSSProperties
                        }
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
                      <h2>
                        <Count id="journal-open" value={open} /> active tickets
                      </h2>
                      <div className="journal-pills">
                        <span className="j-pill open">
                          <i />
                          <Count id="journal-needs-care" value={open} />{" "}
                          {V.needsCare}
                        </span>
                        <span className="j-pill resolved">
                          <i />
                          <Count id="journal-resolved" value={resolved} />{" "}
                          {V.takenCare}
                        </span>
                      </div>
                      <div className="issue-list">
                        {snapshot?.issues.slice(0, 3).map((i) => (
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
                            <span>
                              <b>{i.title}</b>
                              <small>
                                {i.location.area ||
                                  `${S.entrance} ${i.location.entrance} · ${S.floor} ${i.location.floor}`}
                              </small>
                              <small className="row-status" data-status={i.status}>
                                <i
                                  style={{
                                    background: statusColors[i.status],
                                  }}
                                />
                                {i.status}
                              </small>
                            </span>
                            <Icon name="arrow" />
                          </button>
                        ))}
                      </div>
                      {!snapshot.issues.length && <p>{S.noIssues}</p>}
                      {snapshot.polls.length > 0 && (
                        <div className="mini-poll">
                          <span>{S.advisory}</span>
                          <h3>{snapshot?.polls[0]?.question}</h3>
                          <div className="progress-track">
                            <div
                              style={{
                                transform: `scaleX(${(snapshot?.polls[0]?.total_votes ?? 0) / (building?.apartments || 120)})`,
                              }}
                            />
                          </div>
                          <p>
                            {snapshot?.polls[0]?.total_votes ?? 0} /{" "}
                            {building?.apartments || 120} {S.voted}
                          </p>
                          <small>{S.sealed}</small>
                        </div>
                      )}
                    </>
                  )}
                </aside>
              )}
              {token && view.money && (
                <section
                  className="money-ledger"
                  data-ui
                  aria-label={S.expenses}
                >
                  <div className="money-total">
                    <span>{S.fund}</span>
                    <strong>
                      <Count id="ledger-total" value={totals} format={money} />
                    </strong>
                  </div>
                  <ul>
                    {(report ? groupExpenses(effectiveExpenses(report)) : []).map(
                      ([category, amount]) => (
                        <li key={category}>
                          <i
                            style={{
                              background: categoryColors[category] ?? "#5B6878",
                            }}
                          />
                          <span>{category}</span>
                          <b>{money(amount)}</b>
                        </li>
                      ),
                    )}
                  </ul>
                  {!report && <p>{S.noReports}</p>}
                </section>
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
                        <strong>
                          {snapshot ? (
                            <Count
                              id="fund-total"
                              value={totals}
                              format={money}
                            />
                          ) : (
                            <span className="skeleton skeleton-total" />
                          )}
                        </strong>
                      </span>
                      <span className="fund-arrow-badge" aria-hidden="true">
                        <Icon name="arrow" />
                      </span>
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
                      <b>
                        {snapshot ? (
                          <Count
                            id="receipts"
                            value={
                              report ? effectiveExpenses(report).length : 0
                            }
                          />
                        ) : (
                          <span className="skeleton skeleton-number" />
                        )}
                      </b>
                      <span>{V.receiptsCopy}</span>
                    </div>
                  </section>
                ) : (
                  <div className="arrival-proof">
                    {building && !apartmentCount ? (
                      <>
                        <b>{building.floors}</b>
                        <span>floors</span>
                      </>
                    ) : (
                      <>
                        <b>
                          <Count
                            id="proof-homes"
                            value={apartmentCount ?? 120}
                          />
                        </b>
                        <span>{V.homes}</span>
                        <b>
                          <Count
                            id="proof-entrances"
                            value={building?.entrances ?? 3}
                          />
                        </b>
                        <span>{V.entrances}</span>
                      </>
                    )}
                    <b>1</b>
                    <span>{V.sharedHome}</span>
                  </div>
                )}
                <div className="scene-footnote">
                  <span>{token ? S.drag : V.tryWindow}</span>
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
                </div>
              </footer>
            </div>
          </>
        )}
        {view.cinematic && !sceneFailed && <CinematicHUD />}
      </div>
      {compact && (
        <div className="compact-label">
          <i className={view.connected ? "" : "offline"} />
          {view.connected
            ? snapshot?.apartment
              ? `${S.compactLive} ${snapshot.apartment}`
              : V.sharedLive
            : V.connecting}
        </div>
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
