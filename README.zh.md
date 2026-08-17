# dsh-llm-local-token

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件：让 DSH 的 LLM 请求
直接复用你**本机 CLI 已有的 OAuth 登录态**，不需要另配 API key，也不用重新登录。只要你登录过
Codex CLI 或 Claude Code，这些订阅就会变成 DSH 里可选的模型路由。

| Provider 路由 | 凭据来源 | 端点 |
| --- | --- | --- |
| `openai-codex` | `~/.codex/auth.json`（ChatGPT OAuth，与 `codex` CLI 共用） | `https://chatgpt.com/backend-api` |
| `anthropic` | `~/.claude/.credentials.json`，否则读 macOS Keychain 的 `Claude Code-credentials` | `https://api.anthropic.com` |

插件加载后模型直接出现在模型选择器里。缺少凭据的路由会被跳过，不会导致启动失败。

## 为什么需要它

DSH 通过凭据服务解析 provider 的 key，而个人版 Codex / Claude 订阅是 OAuth-only 的，根本没有
API key。这个插件在每次请求时从 CLI 维护的文件里解析 token，临近过期自动刷新，然后交给 DSH 自带
的 pi-ai 引擎发请求。

## 安装

```bash
# 1. 装进你要启动的 profile（内部转发给 pnpm）
dsh plugin --profile web add dsh-llm-local-token

# 2. 启用：在 profile 的补丁层追加一条 loader entry
#    ~/.dsh/profiles/web/cordis.patch.yml
```

```yaml
- insert:
    - id: llm-local-token
      name: dsh-llm-local-token
```

然后重启 `dsh`。想设为默认模型：

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
