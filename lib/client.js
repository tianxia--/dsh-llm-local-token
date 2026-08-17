window.__ModuleLoader__.load({
	id: "dsh-llm-local-token",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const jsxRuntime = require("react/jsx-runtime");
		const react = require("react");
		const runtime = require("@deepseek-ai/dsh-client-runtime/client");
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
			".ltk_cur{padding:0 6px;border-radius:999px;font-size:10px;line-height:16px;background:var(--dsw-alias-brand-primary,var(--dsw-alias-bg-module-platform));color:var(--dsw-alias-label-primary)}" +
			".ltk_provHead{display:flex;align-items:center;gap:6px;margin-bottom:6px}" +
			".ltk_provName{flex:1;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}" +
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
			empty: "No data yet — send one message to read your quota.",
			resets: "resets {when}", credits: "credits: {balance}",
			current: "current",
		};
		const zh = {
			label: "额度", title: "订阅用量",
			"window.primary": "主窗口", "window.secondary": "次窗口",
			"window.5h": "5 小时", "window.7d": "7 天",
			empty: "暂无数据 —— 发一条消息即可读取额度。",
			resets: "{when}重置", credits: "点数余额：{balance}",
			current: "当前",
		};

		/** Green under 60%, amber under 85%, red above. */
		function tone(used) {
			if (used >= 0.85) return "hsl(4 72% 55%)";
			if (used >= 0.6) return "hsl(38 85% 52%)";
			return "hsl(150 55% 45%)";
		}

		/** Humanize a window length so "10080 minutes" reads as "7 天". */
		function windowLabel(t, entry) {
			const known = t("window." + entry.label);
			if (known !== "window." + entry.label) return known;
			const minutes = entry.windowMinutes ?? 0;
			if (minutes >= 1440) return String(Math.round(minutes / 1440)) + "d";
			if (minutes >= 60) return String(Math.round(minutes / 60)) + "h";
			return String(minutes) + "m";
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
			// The provider of the model this session will actually use. The hook only
			// exists when the host composed model selection (Web); its presence is
			// fixed at registration time, so this call order never changes at runtime.
			const activeProvider = typeof props.useModelSelection === "function"
				? props.useModelSelection((snapshot) => snapshot.current?.provider ?? null)
				: null;
			const wrapRef = react.useRef(null);
			const [pos, setPos] = react.useState(null);
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
			/** The route serving the selected model, when this plugin owns it. */
			const active = activeProvider === null
				? undefined
				: state.providers.find((entry) => entry.provider === activeProvider);
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
							...ordered.map((entry) => jsxs("div", {
								className: activeProvider !== null && entry.provider !== activeProvider ? "ltk_prov ltk_provDim" : "ltk_prov",
								children: [
									jsxs("div", {
										className: "ltk_provHead",
										children: [
											jsx("span", { className: "ltk_provName", children: entry.displayName }),
											entry.provider !== activeProvider ? null : jsx("span", { className: "ltk_cur", children: t("current") }),
											entry.usage?.plan === undefined ? null : jsx("span", { className: "ltk_plan", children: entry.usage.plan }),
										],
									}),
									entry.usage === null
										? jsx("p", { className: "ltk_hint", children: t("empty") })
										: jsxs("div", {
											children: [
												...entry.usage.windows.map((w) => jsx(UsageRow, { t, entry: w }, w.label)),
												entry.usage.credits === undefined || entry.usage.creditsUnlimited === true
													? null
													: jsx("p", { className: "ltk_hint", children: t("credits", { balance: String(entry.usage.credits) }) }),
											],
										}),
								],
							}, entry.provider)),
						],
					}),
				],
			});
		}

		/** Polls the host route; the snapshot only changes when a request happened. */
		class UsageController {
			/** @param directories - `ctx.modelDirectories`, or undefined off Web. */
			constructor(directories) {
				this.directories = directories;
				this.state = { open: false, providers: [], diag: undefined };
				this.store = runtime.createSnapshotStore({ ...this.state });
				this.timer = undefined;
				this.started = false;
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
			 * The session's shared model-selection store, or undefined when the host
			 * composed no model selection or does not know this session. Both cases
			 * degrade to the every-route view rather than failing the registration.
			 */
			directoryFor(sessionId) {
				if (this.directories === undefined || sessionId === undefined) return undefined;
				try {
					return this.directories.directoryFor(sessionId);
				} catch (_unknownSession) {
					return undefined;
				}
			}

			inject(sessionId) {
				const directory = this.directoryFor(sessionId);
				return {
					hooks: directory === undefined
						? { localTokenUsage: this.store }
						: { localTokenUsage: this.store, modelSelection: directory.store },
					/**
					 * `current` is null until something loads the directory. The composer
					 * model seat normally does, but ask once so a fresh session shows the
					 * right route instead of the union view.
					 */
					ensureSelection: () => {
						if (directory === undefined) return;
						if (directory.store.getSnapshot().current !== null) return;
						directory.load().catch(() => {});
					},
					start: () => {
						if (this.started) return;
						this.started = true;
						this.poll();
						this.timer = setInterval(() => this.poll(), POLL_MS);
					},
					stop: () => {
						if (this.timer !== undefined) clearInterval(this.timer);
						this.timer = undefined;
						this.started = false;
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
			const controller = new UsageController(ctx.get("modelDirectories"));
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
