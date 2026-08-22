const ARKESEL_SMS_API_URL = "https://sms.arkesel.com/api/v2/sms/send";

function cleanString(value, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readEnv(name, fallback = "", maxLength = 500) {
  return cleanString(process.env[name] || fallback, maxLength);
}

function isEnabled() {
  const value = readEnv("SMS_ENABLED").toLowerCase();

  return ["true", "1", "yes", "on"].includes(value);
}

function disabledReason() {
  const value = readEnv("SMS_ENABLED");

  if (!value) {
    return "SMS is disabled because SMS_ENABLED is not set in .env or server/.env.";
  }

  return `SMS is disabled because SMS_ENABLED is ${value}. Set SMS_ENABLED=true and restart the server.`;
}

function defaultCountryCode() {
  const code = readEnv("SMS_DEFAULT_COUNTRY_CODE", "+233").replace(/\s+/g, "");

  return code.startsWith("+") ? code : `+${code}`;
}

export function normalizeSmsPhone(value) {
  const raw = cleanString(value, 40);
  if (!raw) return "";

  const compact = raw.replace(/[^\d+]/g, "");

  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;

  const digits = compact.replace(/\D/g, "");
  const countryCode = defaultCountryCode();
  const countryDigits = countryCode.replace(/\D/g, "");

  if (!digits) return "";
  if (digits.startsWith(countryDigits)) return `+${digits}`;
  if (digits.startsWith("0")) return `${countryCode}${digits.slice(1)}`;

  return `${countryCode}${digits}`;
}

export function isValidSmsPhone(value) {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

function formatMoney(value, currency = "GHS") {
  return `${currency} ${Number(value || 0).toFixed(2)}`;
}

function getOrderItemQuantity(item = {}) {
  const quantity = Number(item.quantity || item.qty || 1);

  return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
}

function compactProductName(value) {
  const name = cleanString(value || "Item", 28);

  return name.length >= 28 ? `${name.slice(0, 25)}...` : name;
}

function compactItemLabel(item = {}) {
  const name = compactProductName(item.name || item.id);
  const variant = [item.selectedSize, item.selectedColor?.name]
    .map((value) => cleanString(value, 24))
    .filter(Boolean)
    .join("/");

  return `${name}${variant ? ` ${variant}` : ""} x${getOrderItemQuantity(item)}`;
}

function compactOrderItems(order = {}) {
  const items = Array.isArray(order.items) ? order.items : [];

  if (!items.length) return "";

  const labels = items.slice(0, 2).map(compactItemLabel);
  const remaining = items.length - labels.length;
  const summary = `${labels.join("; ")}${remaining > 0 ? ` +${remaining}` : ""}`;

  return summary.length <= 90
    ? summary
    : `${order.itemCount || items.length} items`;
}

function normalizeArkeselRecipient(value) {
  return normalizeSmsPhone(value).replace(/\D/g, "");
}

function sanitizeProviderPayload(value, depth = 0) {
  if (depth > 4) return "[truncated]";

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeProviderPayload(item, depth + 1));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (/recipient|phone|mobile|msisdn|destination|to/i.test(key)) {
          return [key, "[redacted]"];
        }

        return [key, sanitizeProviderPayload(item, depth + 1)];
      }),
    );
  }

  if (typeof value === "string") {
    return value.length > 300 ? `${value.slice(0, 300)}...` : value;
  }

  return value;
}

function orderCodeSmsBody(order = {}, context = {}) {
  const brand = readEnv("SMS_BRAND_NAME", "LisaTrendz");
  const code = order.orderCode || order.id;
  const customerName = cleanString(order.customer?.name || "", 80);
  const firstName = customerName.split(/\s+/).filter(Boolean)[0] || "";
  const greeting = firstName ? `Hi ${firstName}. ` : "";
  const total = formatMoney(
    order.total || order.amountPaid || 0,
    order.currency || "GHS",
  );
  const status =
    context.status === "paid_stock_review"
      ? "Paid, stock check"
      : "Paid";
  const items = compactOrderItems(order);

  return `${brand}: ${greeting}${status}. Code ${code}. ${items ? `${items}. ` : ""}${total}. Track on site.`;
}

function getArkeselSender() {
  const sender = readEnv(
    "ARKESEL_SENDER_ID",
    readEnv("SMS_BRAND_NAME", "LisaTrendz"),
  );
  const cleanSender = sender.replace(/\s+/g, "").slice(0, 11);

  if (!/^[A-Za-z0-9]{1,11}$/.test(cleanSender)) {
    throw new Error(
      "Arkesel sender ID must be 1-11 letters/numbers without spaces.",
    );
  }

  return cleanSender;
}

async function sendArkeselSms({ to, body }) {
  const apiKey = readEnv("ARKESEL_API_KEY");
  const recipient = normalizeArkeselRecipient(to);
  const callbackUrl = readEnv("ARKESEL_CALLBACK_URL", "", 1000);

  if (!apiKey) {
    throw new Error("Arkesel SMS API key is not configured.");
  }

  if (!body || body.replace(/\s+/g, "") === normalizeSmsPhone(to)) {
    throw new Error("SMS body is invalid. The order code message was not built.");
  }

  if (!recipient) {
    throw new Error("The Arkesel recipient number is invalid.");
  }

  const requestBody = {
    sender: getArkeselSender(),
    message: body,
    recipients: [recipient],
  };

  if (callbackUrl) {
    try {
      const parsedUrl = new URL(callbackUrl);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error();
      }

      requestBody.callback_url = parsedUrl.toString();
    } catch (e) {
      throw new Error("ARKESEL_CALLBACK_URL must be a valid http or https URL.");
    }
  }

  const response = await fetch(readEnv("ARKESEL_SMS_API_URL", ARKESEL_SMS_API_URL), {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
  const payload = await response.json().catch(() => ({}));
  const status = cleanString(payload.status, 80).toLowerCase();

  if (!response.ok || status === "error" || status === "failed") {
    throw new Error(payload.message || payload.error || "Arkesel could not send the SMS.");
  }

  return {
    sent: true,
    provider: "arkesel",
    id:
      payload.data?.id ||
      payload.id ||
      payload.messageId ||
      payload.reference ||
      null,
    status: status || "sent",
    to,
    messagePreview: body,
    creditsUsed: payload.data?.credits_used || payload.credits_used || null,
    providerMessage: payload.message || payload.error || null,
    providerResponse: sanitizeProviderPayload(payload),
    deliveryStatus: "accepted_by_provider",
    callbackConfigured: Boolean(callbackUrl),
  };
}

async function sendSms({ to, body }) {
  if (!isEnabled()) {
    return {
      sent: false,
      skipped: true,
      reason: disabledReason(),
      messagePreview: body,
    };
  }

  const provider = readEnv("SMS_PROVIDER", "arkesel").toLowerCase();
  const normalizedTo = normalizeSmsPhone(to);

  if (!isValidSmsPhone(normalizedTo)) {
    throw new Error("The SMS phone number must be in a valid mobile format.");
  }

  if (provider === "arkesel") {
    return sendArkeselSms({ to: normalizedTo, body });
  }

  throw new Error(`Unsupported SMS provider: ${provider}`);
}

async function sendOrderCodeSms(order = {}, context = {}) {
  const to = order.phone || order.customer?.phone;
  const body = orderCodeSmsBody(order, context);

  const result = await sendSms({ to, body });

  return {
    ...result,
    messagePreview: result.messagePreview || body,
  };
}

export default {
  sendOrderCodeSms,
};
