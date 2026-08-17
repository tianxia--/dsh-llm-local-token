# dsh-llm-local-token

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件：让 DSH 的 LLM 请求
直接复用你**本机 CLI 已有的 OAuth 登录态**，不需要另配 API key，也不用重新登录。只要你登录过
Codex CLI 或 Claude Code，这些订阅就会变成 DSH 里可选的模型路由。

| Provider 路由 | 凭据来源 | 端点 |
| --- | --- | --- |
| `openai-codex` | `~/.codex/auth.json`（ChatGPT OAuth，与 `codex` CLI 共用） | `https://chatgpt.com/backend-api` |
| `anthropic` | `~/.claude/.credentials.json`，否则读 macOS Keychain 的 `Claude Code-credentials` | `https://api.anthropic.com` |

插件加载后模型直接出现在模型选择器里。缺少凭据的路由会被跳过，不会导致启动失败。

<table>
<tr>
<td align="center" width="50%"><sub>两份订阅都成了模型选择器里的路由</sub><br><img src="https://raw.githubusercontent.com/tianxia--/dsh-llm-local-token/main/docs/model-routes.png" alt="DSH 模型选择器中的 OpenAI Codex (local token) 与 Claude (local token) 分组" width="330"></td>
<td align="center" width="50%"><sub>订阅用量，来自 provider 的 rate-limit 响应头</sub><br><img src="https://raw.githubusercontent.com/tianxia--/dsh-llm-local-token/main/docs/subscription-usage.png" alt="订阅用量弹层，显示 Claude 与 OpenAI Codex 的配额窗口" width="400"></td>
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

## 订阅用量徽标

两家 provider 都在响应头里返回额度状态，插件顺带读取即可 —— 不轮询、不额外调接口。输入框工具条上
（上下文圆环旁边）会出现一个徽标，点开看明细。

| Provider | 读取的响应头 | 展示内容 |
| --- | --- | --- |
| `openai-codex` | `x-codex-primary-*`、`x-codex-secondary-*`、`x-codex-plan-type`、`x-codex-credits-balance` | 套餐、各窗口已用百分比、重置倒计时、点数余额 |
| `anthropic` | `anthropic-ratelimit-unified-{5h,7d}-{utilization,reset,status}` | 5 小时与 7 天窗口的已用百分比、重置倒计时 |

低于 60% 显示绿色，低于 85% 琥珀色，更高显示红色。数值来自**最近一次真实请求**，所以刚启动时会显示
「暂无数据」，发一条消息即可。浏览器端每 15 秒轮询 `GET /llm-local-token/usage`，该路由只读内存快照。

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
