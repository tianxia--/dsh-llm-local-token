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
			".ltk_pop{position:fixed;z-index:220;width:280px;max-width:calc(100vw - 32px);padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:linear-gradient(var(--dsw-specific-menu,transparent),var(--dsw-specific-menu,transparent)),var(--dsw-alias-bg-layer-2,#2c2c2e);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);box-shadow:0 12px 32px rgba(0,0,0,.28)}" +
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
			".ltk_trendBar{flex:1;align-self:flex-end;border-radius:2px 2px 0 0}" +
			".ltk_plan{padding:0 6px;border-radius:999px;font-size:10px;line-height:16px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary)}" +
			".ltk_row{margin-top:6px}" +
			".ltk_rowTop{display:flex;align-items:baseline;gap:6px;font-size:11px;color:var(--dsw-alias-label-tertiary)}" +
			".ltk_rowLabel{flex:1}" +
			".ltk_pct{font-variant-numeric:tabular-nums;font-weight:600;color:var(--dsw-alias-label-primary)}" +
			".ltk_bar{height:4px;margin-top:3px;border-radius:999px;background:var(--dsw-alias-bg-module-platform);overflow:hidden}" +
			".ltk_fill{height:100%;border-radius:999px}" +
			".ltk_hint{margin:8px 0 0;font-size:11px;color:var(--dsw-alias-label-tertiary);line-height:1.5}" +
			// ── Settings → Models sign-in card ──────────────────────────────────
			".ltk_auth{margin-top:10px;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column;gap:6px}" +
			".ltk_authFirst{margin-top:0;padding-top:0;border-top:none}" +
			".ltk_authSection{margin-top:12px;padding:12px 14px;border:.5px solid var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l2));background:var(--dsw-alias-settings-card-fill,var(--dsw-alias-bg-module-platform));border-radius:var(--dsw-radius-xl,12px);display:flex;flex-direction:column;gap:6px}" +
			".ltk_authSectionTitle{margin:0;font-size:14px;font-weight:500;line-height:22px;color:var(--dsw-alias-label-primary)}" +
			".ltk_authHead{display:flex;align-items:center;gap:8px}" +
			".ltk_authTitle{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}" +
			".ltk_authPill{padding:0 7px;border-radius:999px;font-size:10px;line-height:16px;border:.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary)}" +
			".ltk_authPillOk{border-color:transparent;background:var(--dsw-alias-state-success-tertiary,var(--dsw-alias-bg-module-platform));color:var(--dsw-alias-state-success-primary,var(--dsw-alias-label-primary))}" +
			".ltk_authMeta{margin:0;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary);word-break:break-word}" +
			".ltk_authErr{margin:0;font-size:11px;line-height:1.5;color:var(--dsw-alias-state-error-primary);word-break:break-word}" +
			".ltk_authRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}" +
			".ltk_authBtn{box-sizing:border-box;display:inline-flex;align-items:center;height:28px;padding:0 12px;border-radius:8px;border:none;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font:inherit;font-size:12px;cursor:pointer;text-decoration:none}" +
			".ltk_authBtn:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}" +
			".ltk_authBtn:disabled{opacity:.5;cursor:default}" +
			".ltk_authGhost{box-sizing:border-box;display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:8px;border:.5px solid var(--dsw-alias-border-l3);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}" +
			".ltk_authGhost:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}" +
			".ltk_authInput{box-sizing:border-box;height:28px;flex:1;min-width:160px;padding:0 8px;border-radius:8px;border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}" +
			// Visual order inside the Models section. That section is a flex column,
			// and it renders its add-provider control *before* the footer seat this
			// block lives in — so without a nudge the sign-in cards sit under
			// "Add model provider", away from the providers they describe. Pushing the
			// add control last puts them back beside the provider list. CSS-module
			// class names are hashed, hence the substring match; if a future version
			// renames it, the block simply stays where it is.
			"[class*='_section']>[class*='_addBlock']{order:1}";

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
			"card.title": "Local subscription sign-in",
			"card.section": "Local subscription sign-in",
			"card.sectionHint": "Reuses this machine's Codex / Claude Code login — no separate API key.",
			"card.codex": "OpenAI Codex (local token)",
			"card.claude": "Claude (local token)",
			"card.ok": "Authorized", "card.off": "Not authorized",
			"card.signin": "Sign in",
			"card.open": "Open sign-in page", "card.cancel": "Cancel",
			"card.waiting": "Waiting for the browser sign-in — this card updates by itself.",
			"card.codeHint": "If the terminal asks for a code, paste it here.",
			"card.submit": "Submit",
			"card.account": "account {account}", "card.expires": "valid until {when}",
			"card.source": "credential: {source}",
			"card.failed": "Sign-in failed: {reason}",
			"card.refresh": "Refresh",
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
			"card.title": "本地订阅授权",
			"card.section": "本地订阅授权",
			"card.sectionHint": "复用本机 Codex / Claude Code 的登录态，不需要另配 API key。",
			"card.codex": "OpenAI Codex（本地 token）",
			"card.claude": "Claude（本地 token）",
			"card.ok": "已授权", "card.off": "未授权",
			"card.signin": "授权登录",
			"card.open": "打开授权页", "card.cancel": "取消",
			"card.waiting": "等待完成浏览器里的登录——本卡片会自动刷新。",
			"card.codeHint": "若终端提示输入授权码，粘贴到这里。",
			"card.submit": "提交",
			"card.account": "账户 {account}", "card.expires": "有效期至 {when}",
			"card.source": "凭据：{source}",
			"card.failed": "授权失败：{reason}",
			"card.refresh": "刷新",
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
														// Only worth drawing when there is usage to see: an all-zero week
														// (a route you barely touch, or history that just started) renders as
														// a row of stubs that looks like data but is not.
														trend[entry.provider]?.some((d) => d.peak > 0)
															? jsxs("div", {
																className: "ltk_trendRow",
																children: [
																	jsx("span", { className: "ltk_trendLabel", children: t("trend") }),
																	jsx("div", { className: "ltk_trend", children: dailyPeaks(trend[entry.provider]).map((d) =>
																		jsx("div", { className: "ltk_trendBar", style: { height: d.peak > 0 ? Math.max(12, Math.round(d.peak * 100)) + "%" : "2px", background: d.peak > 0 ? tone(d.peak) : "transparent" }, title: d.label + " " + Math.round(d.peak * 100) + "%" }, d.day)
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

		// ── Settings → Models: the sign-in card ──────────────────────────────────
		//
		// The Models page dispatches its provider-card seat per row, keyed by the
		// settings namespace that owns the row. These routes surface through the
		// pi-ai directory (it declares every catalog provider), so the host publishes
		// the real keys at page bootstrap; the fallbacks cover a composition where
		// the rows come from this plugin's own adapter registration instead.
		const AUTH_ROUTES = new Set(["openai-codex", "anthropic"]);
		const AUTH_GLOBAL = "__DSH_LLM_LOCAL_TOKEN__";
		const AUTH_FALLBACK_KEYS = ["llm-pi-ai", ""];
		const AUTH_TICK_MS = 2500;

		/** Page-bootstrap facts the host published (route prefix plus slot keys). */
		function authBootstrap() {
			const published = typeof window === "undefined" ? undefined : window[AUTH_GLOBAL];
			return published !== null && typeof published === "object" ? published : {};
		}

		/** Where the sign-in routes live. */
		function authPath() {
			const route = authBootstrap().authRoute;
			return typeof route === "string" && route.length > 0 ? route : "/llm-local-token/auth";
		}

		/** The slot keys to mount the card under. */
		function authSlotKeys() {
			const published = authBootstrap().slotKeys;
			if (!Array.isArray(published)) return AUTH_FALLBACK_KEYS;
			const keys = published.filter((key) => typeof key === "string");
			return keys.length === 0 ? AUTH_FALLBACK_KEYS : [...new Set(keys)];
		}

		/** One JSON round trip to the sign-in route. */
		async function authCall(path, body) {
			const response = await fetch(authPath() + path, body === undefined
				? { headers: { Accept: "application/json" } }
				: { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
			const text = await response.text();
			const payload = text.length === 0 ? {} : JSON.parse(text);
			if (!response.ok) throw new Error(payload?.error ?? `HTTP ${response.status}`);
			return payload;
		}

		/** A short local clock label for a token expiry, or "" when unknown. */
		function expiryLabel(at) {
			if (typeof at !== "number" || !Number.isFinite(at)) return "";
			return new Date(at).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
		}

		/** The live login of one provider inside a status snapshot, if any. */
		function pendingLogin(snapshot, provider) {
			const entry = snapshot?.providers?.find((candidate) => candidate.provider === provider);
			const state = entry?.login?.state;
			return state === "starting" || state === "waiting" ? entry.login : undefined;
		}

		/**
		 * The card body. Kept apart from `ProviderAuthCard` so the gate can return
		 * before any hook runs: a row this plugin does not serve mounts no poller.
		 */
		function AuthCardBody(props) {
			const { provider, t } = props;
			/** The row card shows the section title; the footer names its provider. */
			const title = typeof props.title === "string" && props.title.length > 0 ? props.title : t("card.title");
			const [snapshot, setSnapshot] = react.useState(null);
			const [error, setError] = react.useState("");
			const [busy, setBusy] = react.useState(false);
			const [code, setCode] = react.useState("");
			const alive = react.useRef(true);

			/** Fetch one status snapshot; returns it so the poller can read the state it wrote. */
			const load = react.useCallback(async () => {
				try {
					const next = await authCall("");
					if (!alive.current) return null;
					setSnapshot(next);
					setError("");
					return next;
				} catch (failure) {
					if (alive.current) setError(String(failure?.message ?? failure));
					return null;
				}
			}, []);

			react.useEffect(() => {
				alive.current = true;
				load();
				// Signing in from a terminal, or in another tab, changes the credential
				// behind this card's back; re-reading on focus keeps it honest.
				const onFocus = () => void load();
				if (typeof window !== "undefined") window.addEventListener("focus", onFocus);
				return () => {
					alive.current = false;
					if (typeof window !== "undefined") window.removeEventListener("focus", onFocus);
				};
			}, [load]);

			const pending = pendingLogin(snapshot, provider);
			const waiting = pending !== undefined;
			const entry = snapshot?.providers?.find((candidate) => candidate.provider === provider) ?? null;
			const loginState = entry?.login?.state ?? "idle";
			/**
			 * Poll while a login exists, and stop only after two ticks have *seen* it
			 * settle. Stopping on the settle itself is what leaves "not authorized" on
			 * screen right after a successful sign-in: the snapshot a browser holds is
			 * the one fetched before the credential landed.
			 */
			react.useEffect(() => {
				if (loginState === "idle") return undefined;
				let settled = 0;
				const timer = setInterval(async () => {
					const next = await load();
					const state = next?.providers?.find((candidate) => candidate.provider === provider)?.login?.state ?? "idle";
					const terminal = state === "authorized" || state === "failed" || state === "cancelled";
					settled = terminal ? settled + 1 : 0;
					if (settled >= 2) clearInterval(timer);
				}, AUTH_TICK_MS);
				return () => clearInterval(timer);
			}, [loginState, load, provider]);

			const run = async (path, body) => {
				setBusy(true);
				setError("");
				try {
					await authCall(path, body);
					await load();
				} catch (failure) {
					setError(String(failure?.message ?? failure));
				} finally {
					setBusy(false);
				}
			};

			const submit = (event) => {
				event.preventDefault();
				const value = code.trim();
				if (value.length === 0) return;
				setCode("");
				void run("/input", { provider, text: value });
			};

			const authorized = entry?.authorized === true;
			const detail = [];
			if (authorized) {
				if (typeof entry.account === "string" && entry.account.length > 0) detail.push(t("card.account", { account: entry.account }));
				const expires = expiryLabel(entry.expiresAt);
				if (expires.length > 0) detail.push(t("card.expires", { when: expires }));
				if (typeof entry.source === "string" && entry.source.length > 0) detail.push(t("card.source", { source: entry.source }));
			} else if (typeof entry?.reason === "string" && entry.reason.length > 0) {
				detail.push(entry.reason);
			}
			// A failed *re*-authorization must not read as "this route is broken": the
			// old credential still works, so only an unauthorized route reports it.
			const loginError = waiting || authorized || entry == null ? "" : String(entry?.login?.error ?? "");
			const url = typeof pending?.url === "string" ? pending.url : "";

			return jsxs("div", { className: "ltk_auth" + (props.divider === false ? " ltk_authFirst" : ""), children: [
				jsxs("div", { className: "ltk_authHead", children: [
					jsx("span", { className: "ltk_authTitle", children: title }),
					jsx("span", { className: authorized ? "ltk_authPill ltk_authPillOk" : "ltk_authPill", children: authorized ? t("card.ok") : t("card.off") }),
				] }),
				detail.length === 0 ? null : jsx("p", { className: "ltk_authMeta", children: detail.join(" · ") }),
				error.length === 0 ? null : jsx("p", { className: "ltk_authErr", children: error }),
				loginError.length === 0 ? null : jsx("p", { className: "ltk_authErr", children: t("card.failed", { reason: loginError }) }),
				// The action row exists only when there is something to do: a pending login
				// to finish, or a route that still needs signing in. An authorized route
				// shows its status and nothing else — re-signing in is a terminal job
				// (`codex login`), and offering the button read like a standing request.
				waiting || !authorized ? jsxs("div", { className: "ltk_authRow", children: waiting
					? [
						url.length === 0 ? null : jsx("a", { className: "ltk_authBtn", href: url, target: "_blank", rel: "noreferrer", children: t("card.open") }, "open"),
						jsx("button", { type: "button", className: "ltk_authGhost", onClick: () => void run("/cancel", { provider }), children: t("card.cancel") }, "cancel"),
					]
					: [jsx("button", { type: "button", className: "ltk_authBtn", disabled: busy, onClick: () => void run("/login", { provider }), children: t("card.signin") }, "signin")] }) : null,
				waiting ? jsx("p", { className: "ltk_authMeta", children: t("card.waiting") }) : null,
				waiting ? jsxs("form", { className: "ltk_authRow", onSubmit: submit, children: [
					jsx("input", { className: "ltk_authInput", value: code, placeholder: t("card.codeHint"), onChange: (event) => setCode(event.target.value) }),
					jsx("button", { type: "submit", className: "ltk_authGhost", disabled: code.trim().length === 0, children: t("card.submit") }),
				] }) : null,
			] });
		}

		/** The routes the section-level card lists, in display order. */
		const AUTH_ROUTE_LIST = ["openai-codex", "anthropic"];

		/**
		 * The section-level card.
		 *
		 * It lives in the Models page's footer seat for a structural reason: the
		 * section only draws rows it judges *configured* (a profile under the owning
		 * settings namespace), while these two routes exist as pi-ai catalog rows
		 * that nothing configures — the plugin serves them, so there is no profile to
		 * draw. The footer is rendered unconditionally, so it is the one seat that
		 * always shows them, signed in or not.
		 */
		function ProviderAuthFooter(props) {
			const { t } = props;
			const nameOf = (provider) => (provider === "anthropic" ? t("card.claude") : t("card.codex"));
			return jsxs("div", { className: "ltk_authSection", children: [
				jsx("h3", { className: "ltk_authSectionTitle", children: t("card.section") }),
				jsx("p", { className: "ltk_authMeta", children: t("card.sectionHint") }),
				...AUTH_ROUTE_LIST.map((provider, index) => jsx(AuthCardBody, {
					provider,
					title: nameOf(provider),
					divider: index > 0,
					t,
				}, provider)),
			] });
		}

		/** The Models card seat's registrant: only this plugin's routes render. */
		function ProviderAuthCard(props) {
			const entry = props?.provider;
			if (entry === undefined || entry === null || !AUTH_ROUTES.has(entry.provider)) return null;
			return jsx(AuthCardBody, { provider: entry.provider, t: props.t });
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
			// One card seat per provider row. The Models section keys this slot by the
			// row's owning settings namespace, so mount under every key the host
			// published; the card itself filters out rows this plugin does not serve.
			for (const key of authSlotKeys()) {
				ctx.slots.inject("settings.models.provider-card", () => ctx.slots.register({
					name: "settings.models.provider-card",
					id: "local-token-auth-" + (key.length === 0 ? "direct" : key),
					key,
					order: 50,
					locale: NS,
				}, ProviderAuthCard));
			}
			// The footer seat, which the section renders unconditionally: dormant
			// directory rows are never drawn, so this is where these routes appear.
			ctx.slots.inject("settings.models.footer", () => ctx.slots.register({
				name: "settings.models.footer",
				id: "local-token-auth",
				order: 40,
				locale: NS,
			}, ProviderAuthFooter));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
