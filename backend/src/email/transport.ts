import net from "node:net";
import tls from "node:tls";
import os from "node:os";
import { logger } from "../logger.js";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

type SmtpSocket = net.Socket | tls.TLSSocket;

function provider(): "console" | "smtp" {
  const raw = (process.env.EMAIL_PROVIDER ?? "console").toLowerCase();
  if (raw === "smtp") return "smtp";
  return "console";
}

function timeoutMs(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function fromHeader(): string {
  return process.env.EMAIL_FROM ?? "DealLock <no-reply@localhost>";
}

function envelopeAddress(headerValue: string): string {
  const match = headerValue.match(/<([^>]+)>/);
  return (match?.[1] ?? headerValue).trim();
}

function cleanHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function dotStuff(text: string): string {
  return text
    .replace(/\r?\n/g, "\r\n")
    .split("\r\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

function buildMessage(message: EmailMessage): string {
  const from = cleanHeader(fromHeader());
  const to = cleanHeader(message.to);
  const subject = cleanHeader(message.subject);
  return [
    `Date: ${new Date().toUTCString()}`,
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    dotStuff(message.text),
  ].join("\r\n");
}

function connectSmtp(host: string, port: number, secure: boolean): Promise<SmtpSocket> {
  return new Promise((resolve, reject) => {
    const connectTimeoutMs = timeoutMs("SMTP_CONNECTION_TIMEOUT_MS", 10_000);
    const socket = secure
      ? tls.connect({ host, port, servername: host })
      : net.connect({ host, port });

    socket.setTimeout(connectTimeoutMs, () => {
      socket.destroy();
      reject(new Error(`SMTP connection timed out after ${connectTimeoutMs}ms`));
    });

    const onError = (err: Error) => {
      socket.destroy();
      reject(err);
    };

    socket.once("error", onError);
    socket.once(secure ? "secureConnect" : "connect", () => {
      socket.off("error", onError);
      socket.setTimeout(0);
      socket.setEncoding("utf8");
      resolve(socket);
    });
  });
}

function smtpReader(socket: SmtpSocket): () => Promise<string> {
  let buffer = "";
  return () =>
    new Promise((resolve, reject) => {
      const readTimeoutMs = timeoutMs("SMTP_READ_TIMEOUT_MS", 10_000);
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`SMTP read timed out after ${readTimeoutMs}ms`));
      }, readTimeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        socket.off("data", onData);
        socket.off("error", onError);
        socket.off("close", onClose);
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const onClose = () => {
        cleanup();
        reject(new Error("SMTP connection closed"));
      };
      const onData = (chunk: Buffer | string) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        const complete = lines.find((line) => /^\d{3} /.test(line));
        if (!complete) return;
        cleanup();
        resolve(lines.join("\n"));
      };
      socket.on("data", onData);
      socket.once("error", onError);
      socket.once("close", onClose);
    });
}

function upgradeToTls(socket: SmtpSocket, host: string): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const connectTimeoutMs = timeoutMs("SMTP_CONNECTION_TIMEOUT_MS", 10_000);
    const tlsSocket = tls.connect({ socket, servername: host });
    tlsSocket.setTimeout(connectTimeoutMs, () => {
      tlsSocket.destroy();
      reject(new Error(`SMTP TLS upgrade timed out after ${connectTimeoutMs}ms`));
    });
    const onError = (err: Error) => {
      tlsSocket.destroy();
      reject(err);
    };
    tlsSocket.once("error", onError);
    tlsSocket.once("secureConnect", () => {
      tlsSocket.off("error", onError);
      tlsSocket.setTimeout(0);
      tlsSocket.setEncoding("utf8");
      resolve(tlsSocket);
    });
  });
}

async function sendCommand(
  socket: SmtpSocket,
  read: () => Promise<string>,
  command: string,
  allowedCodes: number[],
): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    const writeTimeoutMs = timeoutMs("SMTP_WRITE_TIMEOUT_MS", 10_000);
    const timer = setTimeout(() => {
      reject(new Error(`SMTP write timed out after ${writeTimeoutMs}ms`));
    }, writeTimeoutMs);
    socket.write(`${command}\r\n`, (err) => {
      clearTimeout(timer);
      if (err) reject(err);
      else resolve();
    });
  });
  const response = await read();
  const code = Number(response.slice(0, 3));
  if (!allowedCodes.includes(code)) {
    throw new Error(`SMTP command failed (${code}): ${response}`);
  }
  return response;
}

async function sendSmtpEmail(message: EmailMessage): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host) throw new Error("SMTP_HOST is required when EMAIL_PROVIDER=smtp");
  const secure = process.env.SMTP_SECURE === "true";
  const port = Number(process.env.SMTP_PORT ?? (secure ? 465 : 25));
  if (!Number.isInteger(port) || port <= 0) throw new Error("SMTP_PORT must be a positive integer");

  let socket = await connectSmtp(host, port, secure);
  let read = smtpReader(socket);

  try {
    const greeting = await read();
    if (!greeting.startsWith("220")) throw new Error(`SMTP greeting failed: ${greeting}`);

    const ehloResponse = await sendCommand(socket, read, `EHLO ${os.hostname() || "localhost"}`, [250]);

    if (!secure && /\bSTARTTLS\b/i.test(ehloResponse)) {
      await sendCommand(socket, read, "STARTTLS", [220]);
      socket = await upgradeToTls(socket, host);
      read = smtpReader(socket);
      await sendCommand(socket, read, `EHLO ${os.hostname() || "localhost"}`, [250]);
    }

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await sendCommand(socket, read, "AUTH LOGIN", [334]);
      await sendCommand(socket, read, Buffer.from(process.env.SMTP_USER).toString("base64"), [334]);
      await sendCommand(socket, read, Buffer.from(process.env.SMTP_PASS).toString("base64"), [235]);
    }

    await sendCommand(socket, read, `MAIL FROM:<${envelopeAddress(fromHeader())}>`, [250]);
    await sendCommand(socket, read, `RCPT TO:<${envelopeAddress(message.to)}>`, [250, 251]);
    await sendCommand(socket, read, "DATA", [354]);
    await sendCommand(socket, read, `${buildMessage(message)}\r\n.`, [250]);
    await sendCommand(socket, read, "QUIT", [221, 250]);
  } finally {
    socket.end();
  }
}

export async function sendRawEmail(message: EmailMessage): Promise<void> {
  if (provider() === "console") {
    // Console transport — for local development only.
    process.stdout.write("\n--- DealLock console email ---\n");
    process.stdout.write(`To: ${message.to}\n`);
    process.stdout.write(`From: ${fromHeader()}\n`);
    process.stdout.write(`Subject: ${message.subject}\n\n`);
    process.stdout.write(`${message.text}\n`);
    process.stdout.write("--- end DealLock console email ---\n\n");
    return;
  }

  try {
    await sendSmtpEmail(message);
    logger.info("Email sent", { to: message.to, subject: message.subject });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error("Email send failed", { to: message.to, subject: message.subject, error: errMsg });
    throw err;
  }
}
