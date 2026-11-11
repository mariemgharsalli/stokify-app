export default function SuggestionChips({ items, onPick, disabled }) {
  if (!items?.length) return null;
  return (
    <div className="terrain-chat-chips">
      {items.map((text) => (
        <button
          key={text}
          type="button"
          disabled={disabled}
          onClick={() => onPick(text)}
          className="min-h-12 rounded-2xl border border-border bg-app-bg px-3 text-start text-base font-semibold touch-manipulation disabled:opacity-50"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
