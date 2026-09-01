# dsh-llm-local-token

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件：让 DSH 的 LLM 请求
直接复用你**本机 CLI 已有的 OAuth 登录态**，不需要另配 API key，也不用重新登录。只要你登录过
Codex CLI 或 Claude Code，这些订阅就会变成 DSH 里可选的模型路由。

| Provider 路由 | 凭据来源 | 端点 |
| --- | --- | --- |
| `openai-codex` | `~/.codex/auth.json`（ChatGPT OAuth，与 `codex` CLI 共用） | `https://chatgpt.com/backend-api` |
| `anthropic` | `~/.claude/.credentials.json`，否则读 macOS Keychain 的 `Claude Code-credentials` | `https://api.anthropic.com` |

插件加载后模型直接出现在模型选择器里。缺少凭据的路由会被跳过，不会导致启动失败。

用量徽标另外还会报告 **GLM Coding Plan** 的订阅额度。GLM 的调用 DSH 已经通过 pi-ai 自带的
`zai-coding-cn` 路由提供了，所以本插件只补上额度那一半，不会再注册一条路由——模型选择器里
不会多出一个重复的 GLM。详见[订阅用量徽标](#订阅用量徽标)。

<table>
<tr>
<td align="center" width="50%"><sub>两份订阅都成了模型选择器里的路由</sub><br><img src="https://raw.githubusercontent.com/tianxia--/dsh-llm-local-token/main/docs/model-routes.png" alt="DSH 模型选择器中的 OpenAI Codex (local token) 与 Claude (local token) 分组" width="330"></td>
<td align="center" width="50%"><sub>订阅用量：插件能看到的每一份订阅</sub><br><img src="https://raw.githubusercontent.com/tianxia--/dsh-llm-local-token/main/docs/subscription-usage.png" alt="订阅用量弹层，显示 GLM Coding Plan、OpenAI Codex 与 Claude 的配额窗口" width="400"></td>
</tr>
</table>

## 为什么需要它

DSH 通过凭据服务解析 provider 的 key，而个人版 Codex / Claude 订阅是 OAuth-only 的，根本没有
API key。这个插件在每次请求时从 CLI 维护的文件里解析 token，临近过期自动刷新，然后交给 DSH 自带
的 pi-ai 引擎发请求。

## 安装

```bash
dsh plugin --profile web add dsh-llm-local-token

# 或直接从 git 安装
dsh plugin --profile web add https://github.com/tianxia--/dsh-llm-local-token.git
```

然后重启 `dsh`——安装就到这里。本包声明了 profile bundle（`dsh.bundle.patch` →
[`cordis.patch.yml`](cordis.patch.yml)），DSH 会替你插入那条 loader 行，**不需要**
手工编辑 profile 自己的 `cordis.patch.yml`。

<details>
<summary>改为手工启用</summary>

如果你是把插件源码复制进来用，或者想在自己的补丁层里固定它的 `config`，那就自己往
`~/.dsh/profiles/web/cordis.patch.yml` 追加这一行。profile 自己的补丁层在所有 bundle
层之后生效，所以在这里重述同一个 id 也可以覆盖 bundle 的默认值：

```yaml
- insert:
    - id: llm-local-token
      name: dsh-llm-local-token
```

</details>

想设为默认模型：

```yaml
# ~/.dsh/settings.yaml
agent-default-model:
  provider: openai-codex
  model: gpt-5.6-terra
  reasoningEffort: medium
```

## 配置项

全部可选，默认值对应标准 CLI 安装。

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `codexAuthPath` | `$CODEX_HOME/auth.json`，否则 `~/.codex/auth.json` | Codex 凭据文件 |
| `claudeAuthPath` | `~/.claude/.credentials.json` | 旧版 Claude Code 凭据文件 |
| `claudeKeychainService` | `Claude Code-credentials` | 存放 Claude OAuth 数据的 Keychain 服务名 |
| `requireClaude` | `false` | 为 `true` 时找不到 Claude 凭据就启动失败（而不是跳过） |
| `codexTransport` | `"sse"` | Codex 路由的流式通道：`sse` / `websocket` / `websocket-cached` / `auto`。**额度徽标依赖 `sse`**：pi-ai 默认的 `auto` 会走 WebSocket，而 `x-codex-*` 额度响应头只存在于 SSE 响应上，走 WS 时徽标永远是「暂无数据」。想要 WebSocket 就设成 `auto`，代价是没有 Codex 额度数据。 |
| `usageProbe` | `true` | 是否定时刷新额度（每个 provider 一个最小裸请求）。设 `false` 则完全被动，只读真实请求。 |
| `usageProbeIntervalHours` | `4` | 探测间隔小时数。对齐 5 小时窗口（每天重置约五次）；设 `24` 就是每天一次。 |
| `usageProbeAtHour` | — | 本地时钟小时 `0`–`23`，在固定时间每天探测一次。设置后覆盖 `usageProbeIntervalHours`。 |
| `usageProbeStartupDelayMs` | `20000` | 启动探测的延迟。固定时间点只在 dsh 恰好运行时才触发，所以启动本身也是一个触发点。 |
| `usageProbeCodexModel` | `gpt-5.6-terra` | Codex 探测使用的模型，仅作为拿响应头的载体。 |
| `usageProbeAnthropicModel` | `claude-haiku-4-5-20251001` | Anthropic 探测使用的模型，仅作为拿响应头的载体。 |
| `glmQuota` | `true` | 是否报告 GLM Coding Plan 额度。无论开关，都不会注册路由 —— DSH 已经自带 GLM 路由。 |
| `glmApiKey` | — | 直接指定 GLM token，优先级高于所有自动发现的来源。 |
| `glmApiKeyEnv` | `ZAI_CODING_CN_API_KEY` | 查找 GLM token 时使用的环境变量名，同时也是 `$DSH_HOME/.credentials.yaml` 里的 ref 名。 |
| `glmBaseDomain` | `https://open.bigmodel.cn` | 额度接口所在域名。国际站是 `https://api.z.ai`；同一账号下两个域名返回的内容完全一致。 |

## 订阅用量徽标

Codex 与 Claude 都在响应头里返回额度状态，所以真实请求顺带就能读到。但你从没调用过的那条路由无从上报 ——
因此插件还会**定时刷新**：每个 provider 发一个刻意做到最小的请求（Codex 16 个输入 token、Anthropic 9 个），
不带 prompt、skill、工具与历史，也不落存储。输入框工具条上（上下文圆环旁边）会出现一个徽标，点开看明细。

| Provider | 数据来源 | 展示内容 |
| --- | --- | --- |
| `openai-codex` | `x-codex-primary-*`、`x-codex-secondary-*`、`x-codex-plan-type`、`x-codex-credits-balance` | 套餐、各窗口已用百分比、重置倒计时、点数余额 |
| `anthropic` | `anthropic-ratelimit-unified-{5h,7d}-{utilization,reset,status}` | 5 小时与 7 天窗口的已用百分比、重置倒计时 |
| `zai-coding-cn` | `GET /api/monitor/usage/quota/limit` | 套餐等级、5 小时与每周 token 窗口的已用百分比、MCP 工具调用配额 |

GLM 是个例外，而且是刻意为之。DSH 已经通过 pi-ai 内置的 `zai-coding-cn` 路由提供 GLM 调用，
所以本插件只补额度那一半 —— 再注册一条路由只会让模型选择器里多出一个重复的 GLM。它的数字来自订阅
自己的额度接口而不是响应头，因此不需要付出任何探测请求的代价。另外 modlens 会把每条 pi-ai 路由都加上
`modlens-` 前缀再暴露成一个独立条目，徽标会把 `modlens-zai-coding-cn` 视作同一份订阅。

GLM 的凭据按下面的顺序解析，这个顺序保证数字是诚实的 —— 徽标必须报告**真正在扣费的那份订阅**：

1. 本插件配置里的 `glmApiKey`
2. 环境变量 `ZAI_CODING_CN_API_KEY`
3. `$DSH_HOME/.credentials.yaml` 里的同名 ref —— DSH 自己调用时用的就是它
4. `~/.zcode/v2/credentials.json` 的 `oauth:bigmodel:access_token`，对应本地 `zcode` 登录

一个都找不到就跳过 GLM 那一行，和缺少 Codex / Claude 凭据时的处理一致。设 `glmQuota: false` 可彻底关闭。

低于 60% 显示绿色，低于 85% 琥珀色，更高显示红色。超过一分钟的数值会标注**读取时间** —— 5 小时窗口每天
重置约五次，一个看起来实时的过期数字比没有数字更糟。浏览器端每 15 秒轮询 `GET /llm-local-token/usage`，
该路由只读内存快照。

徽标**只显示当前选中模型所属 provider** 的用量：选 Codex 就是 Codex 的窗口，切到 Claude 就换成
Claude 的，不会把两家的数字混在一起。选中的模型由别的 adapter 提供（普通 API key、其他插件）时徽标
直接隐藏 —— 那份额度不属于本插件。展开的弹层仍列出所有路由，当前那条排在最前并标注「当前」，其余淡显。
当前选中项来自 `ctx.modelDirectories`；组合里没有该服务时（非 Web）退回旧的「全部路由合并」显示。

## 环境要求

- Node.js **22.13+**（DSH 本身的底线，`--use-system-ca` 也需要）
- profile 里有 `dsh-base`（它已自带 `dsh-llm-pi-ai` 与 `@earendil-works/pi-ai`）
- 已登录的 CLI：Codex 路由需 `codex login`；Anthropic 路由需用过 Claude Code
- Claude 的 Keychain 读取仅限 macOS；其它系统只查文件

## token 处理

- 每次请求实时读取，不在内存中长期保留
- 剩余有效期不足 5 分钟时自动刷新，并**写回 CLI 读取的同一文件**，因此不会破坏 CLI 的登录态
  （单飞机制：并发请求只触发一次刷新）
- 原子写入，权限 `0600`
- 不打日志、不上传，只发往对应的 provider 端点

## 故障排查

### `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`

说明你的流量经过 TLS 解密代理（Zscaler、Netskope 等企业 MITM）。即使系统信任其根证书，Node 也不
信任。启动 DSH 时二选一：

```bash
node --use-system-ca …                          # 信任系统证书库（Node 22.13+）
NODE_EXTRA_CA_CERTS=/path/to/root-ca.pem dsh …  # 或直接指向代理根证书
```

### `Provider is not configured: openai-codex`

pi-ai 拒绝了 apiKey 覆盖。本插件已为 OAuth-only 的 Codex provider 附加了 api-key 认证方法；若仍
报此错，说明 pi-ai 的 `resolveProviderAuth` 行为有变——请附上 `@earendil-works/pi-ai` 版本反馈。

### 模型列表里看不到 Codex / Claude

看启动日志里的 `llm-local-token: registered …`。如果只列出 `openai-codex`，说明没找到 Claude
凭据（这台机器没用过 Claude Code 时属正常）。

## 注意事项

- 消耗的是你**个人订阅额度**（ChatGPT Plus/Pro、Claude Pro/Max），请遵守服务条款，不要用它把一个
  账号共享给整个团队。
- `chatgpt.com/backend-api` 是 Codex 客户端自用端点，不是公开 API，可能随时变化；需要稳定性就锁
  定 pi-ai 版本。

## 许可

MIT
