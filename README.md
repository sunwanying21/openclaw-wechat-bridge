# openclaw-wechat-bridge

Use WeChat as an unofficial input channel for OpenClaw via a local bridge process.

## Important

- OpenClaw does **not** have an official built-in WeChat channel at this time.
- This repo provides a community bridge approach using `wechaty`.
- WeChat automation can break anytime due to upstream policy/protocol changes. Use at your own risk.

## What This Does

- Receives WeChat messages from selected chats/groups.
- For matching messages (prefix trigger), calls `openclaw agent`.
- Sends OpenClaw's text reply back to WeChat.

## Requirements

- macOS/Linux with Node.js 20+
- OpenClaw CLI installed and working (`openclaw --version`)
- Model auth configured for OpenClaw (`openclaw onboard ...`)
- A working WeChaty puppet setup

## Quick Start

```bash
npm install
cp .env.example .env
# edit .env
npm run start
```

When it starts, scan QR in terminal (if your puppet supports QR login).

## .env

```bash
OPENCLAW_CMD=openclaw
OPENCLAW_AGENT_ID=main
OPENCLAW_USE_LOCAL=true
WECHAT_TRIGGER_PREFIX=openclaw:
WECHATY_NAME=openclaw-wechat-bridge
WECHATY_PUPPET=wechaty-puppet-service
WECHATY_PUPPET_SERVICE_TOKEN=
```

## Behavior

- DM: only messages starting with `WECHAT_TRIGGER_PREFIX` are sent to OpenClaw.
- Group: only messages that mention the bot or start with `WECHAT_TRIGGER_PREFIX` are sent.
- Example trigger:
  - `openclaw: summarize this chat`

## Run as Service (optional)

```bash
npm run start
```

Use `pm2`, `systemd`, or launchd to keep it alive.

## Security

- Never commit real keys/tokens.
- Keep `.env` local only.
- Rotate API keys if leaked.

## Troubleshooting

- `openclaw: command not found`:
  - Set absolute path in `OPENCLAW_CMD`.
- No model response:
  - Reconfigure OpenClaw auth and test: `openclaw agent --local --message "hello"`.
- WeChat login fails:
  - Check puppet/token validity and network access.

## License

MIT
