import 'dotenv/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import qrcodeTerminal from 'qrcode-terminal';
import { WechatyBuilder } from 'wechaty';

const execFileAsync = promisify(execFile);

const OPENCLAW_CMD = process.env.OPENCLAW_CMD || 'openclaw';
const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || '';
const OPENCLAW_USE_LOCAL = String(process.env.OPENCLAW_USE_LOCAL || 'true').toLowerCase() === 'true';
const TRIGGER_PREFIX = (process.env.WECHAT_TRIGGER_PREFIX || 'openclaw:').trim();

const WECHATY_NAME = process.env.WECHATY_NAME || 'openclaw-wechat-bridge';
const WECHATY_PUPPET = process.env.WECHATY_PUPPET || 'wechaty-puppet-service';
const WECHATY_PUPPET_SERVICE_TOKEN = process.env.WECHATY_PUPPET_SERVICE_TOKEN || '';

function buildAgentArgs(text, sessionId) {
  const args = ['agent', '--json', '--session-id', sessionId, '--message', text];
  if (OPENCLAW_USE_LOCAL) args.splice(1, 0, '--local');
  if (OPENCLAW_AGENT_ID) args.push('--agent', OPENCLAW_AGENT_ID);
  return args;
}

function extractReply(stdout) {
  const trimmed = (stdout || '').trim();
  if (!trimmed) return 'OpenClaw returned empty output.';
  try {
    const data = JSON.parse(trimmed);
    return (
      data.replyText ||
      data.reply ||
      data.outputText ||
      data.text ||
      data.message ||
      trimmed
    );
  } catch {
    return trimmed;
  }
}

async function askOpenClaw(text, sessionId) {
  const args = buildAgentArgs(text, sessionId);
  const { stdout, stderr } = await execFileAsync(OPENCLAW_CMD, args, {
    maxBuffer: 10 * 1024 * 1024
  });
  if (stderr && stderr.trim()) {
    console.error('[openclaw stderr]', stderr.trim());
  }
  return extractReply(stdout);
}

function shouldHandleMessage(msg, selfId) {
  if (msg.self()) return false;
  const text = (msg.text() || '').trim();
  if (!text) return false;

  const room = msg.room();
  if (!room) {
    return TRIGGER_PREFIX ? text.toLowerCase().startsWith(TRIGGER_PREFIX.toLowerCase()) : true;
  }

  const mentioned = msg.mentionSelf();
  const prefixed = TRIGGER_PREFIX
    ? text.toLowerCase().startsWith(TRIGGER_PREFIX.toLowerCase())
    : false;
  return Boolean(mentioned || prefixed || text.includes(`@${selfId}`));
}

function normalizePrompt(rawText) {
  let text = rawText.trim();
  if (TRIGGER_PREFIX && text.toLowerCase().startsWith(TRIGGER_PREFIX.toLowerCase())) {
    text = text.slice(TRIGGER_PREFIX.length).trim();
  }
  return text;
}

const wechaty = WechatyBuilder.build({
  name: WECHATY_NAME,
  puppet: WECHATY_PUPPET,
  puppetOptions: {
    token: WECHATY_PUPPET_SERVICE_TOKEN
  }
});

wechaty
  .on('scan', (qrcode, status) => {
    console.log(`\\n[wechaty] scan status=${status}`);
    qrcodeTerminal.generate(qrcode, { small: true });
  })
  .on('login', (user) => {
    console.log(`[wechaty] logged in as ${user.name()} (${user.id})`);
  })
  .on('logout', (user) => {
    console.log(`[wechaty] logged out: ${user?.name?.() || 'unknown'}`);
  })
  .on('error', (err) => {
    console.error('[wechaty error]', err);
  })
  .on('message', async (msg) => {
    try {
      const self = wechaty.currentUser;
      if (!self) return;
      if (!shouldHandleMessage(msg, self.id)) return;

      const text = normalizePrompt(msg.text() || '');
      if (!text) return;

      const talker = msg.talker();
      const room = msg.room();
      const sessionId = room ? `wechat-room:${room.id}` : `wechat-dm:${talker.id}`;

      console.log(`[bridge] incoming from ${talker.name()} session=${sessionId}`);
      const reply = await askOpenClaw(text, sessionId);
      await msg.say(reply);
      console.log('[bridge] replied');
    } catch (err) {
      console.error('[bridge error]', err);
      try {
        await msg.say('Bridge error. Please check server logs.');
      } catch {
        // ignore
      }
    }
  });

console.log('[bridge] starting...');
wechaty
  .start()
  .then(() => {
    console.log('[bridge] started');
  })
  .catch((err) => {
    console.error('[bridge] failed to start', err);
    process.exit(1);
  });
