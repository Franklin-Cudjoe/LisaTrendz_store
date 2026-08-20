import "../styles/whatsapp.css";

const DEFAULT_MESSAGE = "Hello Lisa Trendz, I want to ask about a dress.";

function cleanWhatsAppNumber(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

export default function WhatsAppChat() {
  const number = cleanWhatsAppNumber(import.meta.env.VITE_WHATSAPP_NUMBER);
  const message = import.meta.env.VITE_WHATSAPP_MESSAGE || DEFAULT_MESSAGE;

  if (!number) return null;

  const href = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

  return (
    <a
      className="whatsapp-chat"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with the owner on WhatsApp"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        focusable="false"
        className="whatsapp-chat-icon"
      >
        <path
          fill="currentColor"
          d="M16.04 3.5c-6.9 0-12.5 5.6-12.5 12.5 0 2.2.58 4.35 1.68 6.24L3.5 28.5l6.42-1.69A12.47 12.47 0 0 0 16.04 28.5c6.9 0 12.5-5.6 12.5-12.5s-5.6-12.5-12.5-12.5Zm0 22.86c-2 0-3.94-.57-5.62-1.64l-.4-.25-3.8 1 1.02-3.7-.27-.42A10.28 10.28 0 0 1 5.7 16c0-5.7 4.64-10.34 10.34-10.34S26.38 10.3 26.38 16 21.74 26.36 16.04 26.36Zm5.67-7.74c-.31-.16-1.84-.91-2.12-1.01-.28-.11-.49-.16-.7.16-.2.31-.8 1.01-.98 1.22-.18.2-.36.23-.67.08-.31-.16-1.31-.48-2.5-1.54-.92-.82-1.55-1.84-1.73-2.15-.18-.31-.02-.48.14-.64.14-.14.31-.36.47-.54.16-.18.2-.31.31-.52.1-.2.05-.39-.03-.54-.08-.16-.7-1.68-.95-2.3-.25-.6-.5-.52-.7-.53h-.6c-.2 0-.54.08-.82.39-.28.31-1.07 1.05-1.07 2.56 0 1.51 1.1 2.97 1.25 3.18.16.2 2.17 3.31 5.25 4.64.73.32 1.31.51 1.76.65.74.23 1.41.2 1.94.12.59-.09 1.84-.75 2.1-1.48.26-.73.26-1.35.18-1.48-.08-.13-.28-.2-.59-.36Z"
        />
      </svg>
      <span className="whatsapp-chat-text">WhatsApp</span>
    </a>
  );
}
