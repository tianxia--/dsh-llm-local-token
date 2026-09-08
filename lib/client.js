window.__ModuleLoader__.load({
	id: "dsh-llm-local-token",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const jsxRuntime = require("react/jsx-runtime");
		const react = require("react");
		const clientStore = require("@deepseek-ai/dsh-client-store");
		const jsx = jsxRuntime.jsx;
		const jsxs = jsxRuntime.jsxs;

		const NS = "llm.localToken";
		const ROUTE = "/llm-local-token/usage";
		/** Poll cadence while the composer is mounted. Usage only moves on requests. */
		const POLL_MS = 15000;

		const CSS = ".ltk_wrap{position:relative;display:inline-flex}" +
			".ltk_btn{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 8px;font:inherit;font-size:11px;font-variant-numeric:tabular-nums;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}" +
			".ltk_btn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3)}" +
			".ltk_dot{width:6px;height:6px;border-radius:50%;flex:none}" +
			".ltk_pop{position:fixed;z-index:220;width:280px;max-width:calc(100vw - 32px);padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2));box-shadow:0 12px 32px rgba(0,0,0,.28)}" +
			".ltk_title{margin:0 0 8px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}" +
			".ltk_prov{padding-top:8px;margin-top:8px;border-top:1px solid var(--dsw-alias-border-l2)}" +
			".ltk_prov:first-of-type{padding-top:0;margin-top:0;border-top:none}" +
			".ltk_provDim{opacity:.5}" +
			".ltk_cur{padding:0 6px;border-radius:999px;font-size:10px;line-height:16px;background:var(--dsw-alias-state-success-tertiary,var(--dsw-alias-bg-module-platform));color:var(--dsw-alias-label-primary)}" +
			".ltk_provHead{display:flex;align-items:center;gap:6px;margin-bottom:6px}" +
			".ltk_provName{flex:1;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}" +
			".ltk_provToggle{width:100%;padding:0;border:none;background:none;font:inherit;color:inherit;cursor:pointer;text-align:left}" +
			".ltk_provFlat{margin-bottom:0}" +
			// The chevron is the supplied 16px icon, inlined rather than fetched: one
			// path, so it costs no request and no asset route. Source: docs/arrow.svg.
			//
			// Its artwork sits in the right half of the source canvas (x 8..12.1 of 16),
			// so the viewBox is cropped square around the stroke instead of using the
			// original 0 0 16 16 — otherwise nearly half the box is padding and the
			// arrow looks indented against the window rows below it. Square keeps the
			// 90deg open-state rotation pivoting on the artwork's own centre, so the
			// row's left edge never moves when it toggles.
			//
			// Sized with the row's 10px badges, the smallest type in the panel. Note
			// the box is all ink: a cropped SVG at 10px draws a 10px arrow, where a
			// 10px text glyph drew roughly half that inside its em box — so this
			// still reads larger than the character it replaced.
			".ltk_chev{flex:none;display:block;width:10px;height:10px;color:var(--dsw-alias-label-secondary);transform-origin:50% 50%;transition:transform .12s ease}" +
			".ltk_chevOpen{transform:rotate(90deg)}" +
			".ltk_sum{flex:none;font-size:11px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}" +
			".ltk_trendRow{display:flex;align-items:flex-end;gap:6px;margin-top:6px}" +
			".ltk_trendLabel{flex:none;font-size:10px;color:var(--dsw-alias-label-tertiary)}" +
			".ltk_trend{flex:1;display:flex;align-items:flex-end;gap:3px;height:22px}" +
			".ltk_trendBar{flex:1;min-height:2px;border-radius:2px 2px 0 0}" +
			".ltk_plan{padding:0 6px;border-radius:999px;font-size:10px;line-height:16px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary)}" +
			".ltk_row{margin-top:6px}" +
			".ltk_rowTop{display:flex;align-items:baseline;gap:6px;font-size:11px;color:var(--dsw-alias-label-tertiary)}" +
			".ltk_rowLabel{flex:1}" +
			".ltk_pct{font-variant-numeric:tabular-nums;font-weight:600;color:var(--dsw-alias-label-primary)}" +
			".ltk_bar{height:4px;margin-top:3px;border-radius:999px;background:var(--dsw-alias-bg-module-platform);overflow:hidden}" +
			".ltk_fill{height:100%;border-radius:999px}" +
			".ltk_hint{margin:8px 0 0;font-size:11px;color:var(--dsw-alias-label-tertiary);line-height:1.5}";

		if (typeof document !== "undefined" && document.querySelector('style[data-plugin-css="dsh-llm-local-token"]') === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-llm-local-token";
			tag.dataset.pluginCss = "dsh-llm-local-token";
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}

		const en = {
			label: "Quota", title: "Subscription usage",
			"window.primary": "Primary", "window.secondary": "Secondary",
			"window.5h": "5 hours", "window.7d": "7 days",
			"window.tokens": "Tokens", "window.mcp": "MCP calls",
			empty: "No data yet — send one message to read your quota.",
			resets: "resets {when}", credits: "credits: {balance}",
			current: "current",
			"unit.d": "{n} days", "unit.h": "{n} hours", "unit.m": "{n} min",
			readAt: "read {when} ago",
			trend: "7 days",
			expand: "Show {name} quota", collapse: "Hide {name} quota",
		};
		const zh = {
			label: "额度", title: "订阅用量",
			"window.primary": "主窗口", "window.secondary": "次窗口",
			"window.5h": "5 小时", "window.7d": "7 天",
			"window.tokens": "Token 额度", "window.mcp": "MCP 调用",
			empty: "暂无数据 —— 发一条消息即可读取额度。",
			resets: "{when}重置", credits: "点数余额：{balance}",
			current: "当前",
			"unit.d": "{n} 天", "unit.h": "{n} 小时", "unit.m": "{n} 分钟",
			readAt: "{when}前读取",
			trend: "近 7 天",
			expand: "展开 {name} 额度", collapse: "收起 {name} 额度",
		};

		/** Green under 60%, amber under 85%, red above. */
		function tone(used) {
			if (used >= 0.85) return "hsl(4 72% 55%)";
			if (used >= 0.6) return "hsl(38 85% 52%)";
			return "hsl(150 55% 45%)";
		}

		/**
		 * Name one window by its length, so "10080 minutes" reads as "7 天".
		 *
		 * The duration is the fact a reader acts on and the only one comparable
		 * across providers; Codex's `primary`/`secondary` is opaque vendor
		 * vocabulary that hides a length the response already stated. So the
		 * provider's own label survives only as the fallback for a window that
		 * reports no length at all.
		 */
		function windowLabel(t, entry) {
			const minutes = entry.windowMinutes ?? 0;
			if (minutes >= 1440) return t("unit.d", { n: String(Math.round(minutes / 1440)) });
			if (minutes >= 60) return t("unit.h", { n: String(Math.round(minutes / 60)) });
			if (minutes > 0) return t("unit.m", { n: String(minutes) });
			const known = t("window." + entry.label);
			return known === "window." + entry.label ? entry.label : known;
		}

		/** Compact relative time for a reset instant. */
		function resetIn(iso) {
			const at = Date.parse(iso ?? "");
			if (!Number.isFinite(at)) return "";
			const seconds = Math.max(0, Math.round((at - Date.now()) / 1000));
			if (seconds < 3600) return String(Math.round(seconds / 60)) + "m";
			if (seconds < 86400) return String(Math.round(seconds / 3600)) + "h";
			return String(Math.round(seconds / 86400)) + "d";
		}

		/**
		 * Collapse stored snapshots into one peak per calendar day, oldest first,
		 * padded to the last 7 days (today included). A day with no records yields
		 * 0, which renders as the minimal stub and keeps the time span honest.
		 */
		function dailyPeaks(records, days = 7) {
			const byDay = new Map();
			for (const record of records) {
				const at = Date.parse(record.at ?? "");
				if (!Number.isFinite(at)) continue;
				const key = new Date(at); key.setHours(0, 0, 0, 0);
				for (const w of record.windows ?? []) byDay.set(key.getTime(), Math.max(byDay.get(key.getTime()) ?? 0, w.used));
			}
			const today = new Date(); today.setHours(0, 0, 0, 0);
			const out = [];
			for (let i = days - 1; i >= 0; i--) {
				const day = today.getTime() - i * 86400000;
				out.push({ day, peak: byDay.get(day) ?? 0, label: new Date(day).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }) });
			}
			return out;
		}
		/**
		 * Compact "how long ago" for a snapshot instant; blank under a minute.
		 *
		 * A scheduled probe means a number can be hours old while still looking
		 * live, and a 5-hour window resets about five times a day — so the age is
		 * load-bearing, not decoration. Returning "" for a fresh read keeps the
		 * panel quiet until staleness is the thing worth saying.
		 */
		function agoOf(iso) {
			const at = Date.parse(iso ?? "");
			if (!Number.isFinite(at)) return "";
			const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
			if (seconds < 60) return "";
			if (seconds < 3600) return String(Math.round(seconds / 60)) + "m";
			if (seconds < 86400) return String(Math.round(seconds / 3600)) + "h";
			return String(Math.round(seconds / 86400)) + "d";
		}

		function UsageRow({ t, entry }) {
			const percent = Math.round(entry.used * 100);
			return jsxs("div", {
				className: "ltk_row",
				children: [
					jsxs("div", {
						className: "ltk_rowTop",
						children: [
							jsx("span", { className: "ltk_rowLabel", children: windowLabel(t, entry) }),
							jsx("span", { className: "ltk_pct", children: percent + "%" }),
							entry.resetAt === undefined ? null : jsx("span", { children: t("resets", { when: resetIn(entry.resetAt) }) }),
						],
					}),
					jsx("div", {
						className: "ltk_bar",
						children: jsx("div", { className: "ltk_fill", style: { width: Math.max(2, percent) + "%", background: tone(entry.used) } }),
					}),
				],
			});
		}

		/** The quota badge that sits beside the composer's context ring. */
		function UsageBadge(props) {
			const { t } = props;
			const state = props.useLocalTokenUsage((snapshot) => snapshot);
			// The provider of the model this session will actually use. The controller
			// always supplies this hook — backed by a standing empty selection when the
			// host composed no model selection — so the call is unconditional.
			const activeProvider = props.useModelSelection((snapshot) => snapshot.current?.provider ?? null);
			const wrapRef = react.useRef(null);
			const [pos, setPos] = react.useState(null);
			/** Per-provider 7-day history, fetched on demand when a block is open. */
			const [trend, setTrend] = react.useState({});
			/**
			 * Which provider blocks the reader has explicitly opened or closed, by id.
			 *
			 * Only the route serving the current model is open by default; the rest
			 * fold away but stay one click from their numbers. An override is dropped
			 * when the selection changes, so switching model re-applies that default
			 * instead of stranding an unrelated block open.
			 */
			const [openOverrides, setOpenOverrides] = react.useState({});
			react.useEffect(() => {
				setOpenOverrides({});
			}, [activeProvider]);
			// Fetch-on-demand: expanding a route is the moment the reader asks for its
			// trend, and the endpoint just reads the JSONL the probes already wrote.
			react.useEffect(() => {
				if (!state.open) return undefined;
				for (const entry of state.providers) {
					const defaultOpen = activeProvider === null || covers(entry, activeProvider);
					const open = openOverrides[entry.provider] ?? defaultOpen;
					if (!open || trend[entry.provider] !== undefined) continue;
					const controller = new AbortController();
					fetch(ROUTE.replace(/usage$/, "history/") + encodeURIComponent(entry.provider), { signal: controller.signal })
						.then((response) => (response.ok ? response.json() : { records: [] }))
						.then((body) => setTrend((prev) => ({ ...prev, [entry.provider]: body.records ?? [] })))
						.catch(() => setTrend((prev) => ({ ...prev, [entry.provider]: [] })));
				}
			return undefined;
		}, [state.open, state.providers, openOverrides, activeProvider, trend]);
			react.useEffect(() => {
				props.start();
				props.ensureSelection();
				return () => props.stop();
			}, []);
			react.useEffect(() => {
				if (!state.open) return undefined;
				const measure = () => {
					const rect = wrapRef.current?.getBoundingClientRect();
					if (rect === undefined) return;
					const margin = 16;
					const width = Math.min(280, window.innerWidth - margin * 2);
					setPos({
						left: Math.max(margin, Math.min(Math.round(rect.left), window.innerWidth - width - margin)),
						top: Math.max(margin, Math.round(rect.top) - 12),
						width,
						transform: "translateY(-100%)",
					});
				};
				measure();
				const closeOutside = (event) => {
					if (event.target instanceof Node && wrapRef.current?.contains(event.target) !== true) props.toggle();
				};
				const closeOnEscape = (event) => { if (event.key === "Escape") props.toggle(); };
				window.addEventListener("resize", measure);
				window.addEventListener("scroll", measure, true);
				document.addEventListener("pointerdown", closeOutside);
				document.addEventListener("keydown", closeOnEscape);
				return () => {
					window.removeEventListener("resize", measure);
					window.removeEventListener("scroll", measure, true);
					document.removeEventListener("pointerdown", closeOutside);
					document.removeEventListener("keydown", closeOnEscape);
				};
			}, [state.open]);

			const withData = state.providers.filter((entry) => entry.usage !== null);
			/**
			 * The entry covering the selected model. Matching allows aliases because
			 * one subscription can surface under several picker ids — modlens
			 * re-exposes every route under a `modlens-` prefix, and that wrapper bills
			 * the same account as the route it wraps.
			 */
			const covers = (entry, provider) => entry.provider === provider || (entry.aliases ?? []).includes(provider);
			const active = activeProvider === null
				? undefined
				: state.providers.find((entry) => covers(entry, activeProvider));
			/**
			 * The selected model belongs to some other adapter (a plain API key, a
			 * different plugin): this badge owns no quota fact about it, so it says
			 * nothing rather than showing a number from an unrelated subscription.
			 * Before the first poll the route list is empty, which is "not known yet".
			 */
			const foreign = activeProvider !== null && state.providers.length > 0 && active === undefined;
			// Selection unknown (no model-selection service): fall back to every route.
			const windows = active !== undefined
				? (active.usage === null ? [] : active.usage.windows)
				: withData.flatMap((entry) => entry.usage.windows);
			const headline = windows.map((w) => Math.round(w.used * 100)).slice(0, 2);
			const worst = windows.reduce((max, w) => Math.max(max, w.used), 0);
			// Active route first; the others stay visible but recede.
			const ordered = active === undefined
				? state.providers
				: [active, ...state.providers.filter((entry) => entry !== active)];

			// No local-token route at all (also the render before the first poll
			// answers): the badge has nothing to say, so it does not exist.
			if (state.providers.length === 0 || foreign) return null;

			return jsxs("span", {
				ref: wrapRef,
				className: "ltk_wrap",
				children: [
					jsxs("button", {
						type: "button",
						className: "ltk_btn",
						title: state.diag === undefined
							? t("title")
							: t("title") + " — pid " + state.diag.pid + ", observed " + state.diag.observed,
						onClick: () => props.toggle(),
						children: [
							jsx("span", { className: "ltk_dot", style: { background: windows.length === 0 ? "var(--dsw-alias-label-tertiary)" : tone(worst) } }),
							jsx("span", { children: headline.length === 0 ? t("label") : headline.map((p) => p + "%").join(" · ") }),
						],
					}),
					!state.open ? null : jsxs("div", {
						className: "ltk_pop",
						style: pos === null ? { left: "16px", bottom: "72px" } : { left: pos.left + "px", top: pos.top + "px", width: pos.width + "px", transform: pos.transform },
						children: [
							jsx("p", { className: "ltk_title", children: t("title") }),
							...ordered.map((entry) => {
								// Default: only the route serving the current model is open, because
								// that is the one number this session is actually spending. With no
								// model-selection service there is no "current", so everything opens,
								// matching the union-of-all-routes fallback the badge already uses.
								const defaultOpen = activeProvider === null || covers(entry, activeProvider);
								const open = openOverrides[entry.provider] ?? defaultOpen;
								// A collapsed row still carries its first two windows, so folding a
								// route away costs the detail but not the glance.
								const summary = entry.usage === null ? [] : entry.usage.windows.map((w) => Math.round(w.used * 100)).slice(0, 2);
								return jsxs("div", {
									className: activeProvider !== null && !covers(entry, activeProvider) ? "ltk_prov ltk_provDim" : "ltk_prov",
									children: [
										jsxs("button", {
											type: "button",
											className: open ? "ltk_provHead ltk_provToggle" : "ltk_provHead ltk_provToggle ltk_provFlat",
											"aria-expanded": open,
											title: t(open ? "collapse" : "expand", { name: entry.displayName }),
											onClick: () => setOpenOverrides((prev) => ({ ...prev, [entry.provider]: !open })),
											children: [
												jsx("svg", {
													className: open ? "ltk_chev ltk_chevOpen" : "ltk_chev",
													viewBox: "5.2 3.04 9.7 9.7",
													"aria-hidden": "true",
													// non-scaling-stroke keeps the 1.5px weight the icon was drawn with,
													// independent of how far the cropped viewBox is scaled up.
													children: jsx("path", {
														d: "M8 3.79297L12.1012 7.89419L8 11.9954",
														fill: "none",
														stroke: "currentColor",
														strokeWidth: 1.5,
														strokeLinecap: "round",
														strokeLinejoin: "round",
														vectorEffect: "non-scaling-stroke",
													}),
												}),
												jsx("span", { className: "ltk_provName", children: entry.displayName }),
												activeProvider === null || !covers(entry, activeProvider) ? null : jsx("span", { className: "ltk_cur", children: t("current") }),
												entry.usage?.plan === undefined ? null : jsx("span", { className: "ltk_plan", children: entry.usage.plan }),
												open || summary.length === 0 ? null : jsx("span", { className: "ltk_sum", children: summary.map((p) => p + "%").join(" · ") }),
											],
										}),
										!open
											? null
											: entry.usage === null
												? jsx("p", { className: "ltk_hint", children: t("empty") })
												: jsxs("div", {
													children: [
														// Keyed by position: a provider may report two windows of the
														// same kind (GLM sends two token windows), so the label is not
														// unique and the order is stable.
														...entry.usage.windows.map((w, index) => jsx(UsageRow, { t, entry: w }, index)),
														entry.usage.credits === undefined || entry.usage.creditsUnlimited === true
															? null
															: jsx("p", { className: "ltk_hint", children: t("credits", { balance: String(entry.usage.credits) }) }),
														agoOf(entry.usage.at).length === 0
															? null
															: jsx("p", { className: "ltk_hint", children: t("readAt", { when: agoOf(entry.usage.at) }) }),
														trend[entry.provider]?.length
															? jsxs("div", {
																className: "ltk_trendRow",
																children: [
																	jsx("span", { className: "ltk_trendLabel", children: t("trend") }),
																	jsx("div", { className: "ltk_trend", children: dailyPeaks(trend[entry.provider]).map((d) =>
																		jsx("div", { className: "ltk_trendBar", style: { height: Math.max(8, Math.round(d.peak * 100)) + "%", background: tone(d.peak) }, title: d.label + " " + Math.round(d.peak * 100) + "%" }, d.day)
																	) }),
																],
															})
															: null,
													],
												}),
									],
								}, entry.provider);
							}),
						],
					}),
				],
			});
		}

		/** Polls the host route; the snapshot only changes when a request happened. */
		class UsageController {
			/** @param ctx - the client root context; `modelDirectories` is read from
			 * it per session rather than captured once, because whether the call
			 * succeeds depends on when it happens (see `directoryFor`). */
			constructor(ctx) {
				this.ctx = ctx;
				this.state = { open: false, providers: [], diag: undefined };
				this.store = clientStore.createSnapshotStore({ ...this.state });
				/**
				 * One standing selection store per session, mirroring the host
				 * directory's `current` once we manage to reach it. The hook has to
				 * name a store at registration time, but the directory is not reachable
				 * that early — so the badge subscribes to this instead, and `bind`
				 * fills it in later. Sessions whose directory never resolves keep the
				 * `current: null` seed and fall back to the every-route view.
				 */
				this.selections = new Map();
				this.unbind = new Map();
				this.timer = undefined;
				this.started = false;
			}

			/** The standing mirror for one session, created on first request. */
			selectionFor(sessionId) {
				const key = String(sessionId);
				const existing = this.selections.get(key);
				if (existing !== undefined) return existing;
				const mirror = clientStore.createSnapshotStore({ current: null });
				this.selections.set(key, mirror);
				return mirror;
			}

			/**
			 * Mirror the host's selection into this session's store, once.
			 *
			 * Idempotent and safe to retry: until the directory exists this is a no-op,
			 * so the caller can simply keep asking.
			 */
			bind(sessionId) {
				const key = String(sessionId);
				if (this.unbind.has(key)) return;
				const directory = this.directoryFor(sessionId);
				if (directory === undefined) return;
				const mirror = this.selectionFor(sessionId);
				const copy = () => mirror.set({ current: directory.store.getSnapshot().current ?? null });
				copy();
				this.unbind.set(key, directory.store.subscribe(copy));
				if (directory.store.getSnapshot().current === null) directory.load().catch(() => {});
			}

			publish(patch) {
				this.state = { ...this.state, ...patch };
				this.store.set({ ...this.state });
			}

			async poll() {
				try {
					const response = await fetch(ROUTE, { headers: { Accept: "application/json" } });
					if (!response.ok) return;
					const body = await response.json();
					this.publish({ providers: body.providers ?? [], diag: body.diag });
				} catch (_failure) {
					// Route absent (plugin not loaded on this host): stay silent.
				}
			}

			/**
			 * The session's shared model-selection directory, or undefined when it is
			 * not reachable from here.
			 *
			 * Two ways it is not: the host composed no model selection at all, and —
			 * the case that actually bites — nobody has built this session's directory
			 * yet. Building one reads `remote.session` and `sessions` through the
			 * *caller's* context, and this plugin deliberately injects neither, so
			 * cordis refuses with "cannot get property \"remote.session\" without
			 * inject". Once the composer's own model seat has built it, the resolver
			 * answers from its cache and the same call succeeds. So this is not an
			 * error to report, it is a "not yet" — hence `bind`'s retry.
			 */
			directoryFor(sessionId) {
				if (sessionId === undefined) return undefined;
				const directories = this.ctx.get("modelDirectories");
				if (directories === undefined) return undefined;
				try {
					return directories.directoryFor(sessionId);
				} catch (_notReachableYet) {
					return undefined;
				}
			}

			inject(sessionId) {
				return {
					hooks: {
						localTokenUsage: this.store,
						modelSelection: this.selectionFor(sessionId),
					},
					/** Mount-time attempt; `start`'s tick covers a mount that lands first. */
					ensureSelection: () => this.bind(sessionId),
					start: () => {
						this.bind(sessionId);
						if (this.started) return;
						this.started = true;
						this.poll();
						this.timer = setInterval(() => {
							this.poll();
							this.bind(sessionId);
						}, POLL_MS);
					},
					stop: () => {
						if (this.timer !== undefined) clearInterval(this.timer);
						this.timer = undefined;
						this.started = false;
						// Drop the mirror subscription with the badge; `bind` re-establishes
						// it on the next mount, and the mirror keeps its last value meanwhile.
						const stopMirror = this.unbind.get(String(sessionId));
						if (stopMirror !== undefined) {
							stopMirror();
							this.unbind.delete(String(sessionId));
						}
					},
					toggle: () => {
						const open = !this.state.open;
						this.publish({ open });
						if (open) this.poll();
					},
				};
			}
		}

		const inject = ["slots", "locale"];

		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "llm-local-token: dictionaries");
			// Optional on purpose: read the service rather than declaring it in
			// `inject`, so a composition without model selection still loads this
			// plugin (the badge then reports every route, as it always did).
			const controller = new UsageController(ctx);
			// The quota badge is a clickable control, so it belongs in the input
			// tool row (a list slot), beside the send button.
			ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
				name: "conversation.input.right",
				id: "local-token-usage",
				order: 60,
				locale: NS,
				inject: (sessionId) => controller.inject(sessionId),
			}, UsageBadge));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
