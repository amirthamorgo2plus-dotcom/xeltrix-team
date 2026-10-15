/**
 * A phone number that dials.
 *
 * Most of this team works from a phone, where a number rendered as text means
 * reading it and retyping it into the dialler. The href strips spaces, dashes
 * and brackets because tel: ignores them inconsistently across handsets,
 * while the visible text keeps whatever was typed in — a number someone
 * recognises is easier to check than a normalised one.
 *
 * Renders nothing when there is no number, so callers can drop it in without
 * guarding first.
 */
export function PhoneLink({
  phone,
  className = "",
}: {
  phone?: string | null;
  className?: string;
}) {
  const shown = phone?.trim();
  if (!shown) return null;
  const dial = shown.replace(/[^\d+]/g, "");
  if (!dial) return null;

  return (
    <a
      href={`tel:${dial}`}
      // Negative margin keeps surrounding layout identical while giving the
      // link a 32px hit area.
      className={`-my-1.5 inline-flex min-h-8 items-center py-1.5 underline-offset-2 hover:underline ${className}`}
    >
      {shown}
    </a>
  );
}
