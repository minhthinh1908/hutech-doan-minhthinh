export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

/** Primary / secondary match design system: yellow #FFC107, black #111 */
export const coreToneClass = {
  primary:
    "!bg-[#FFC107] !border-[#E6AC00] !text-[#111111] hover:!bg-[#E6AC00] focus-visible:!ring-2 focus-visible:!ring-[#FFC107]/50 !font-semibold !shadow-sm hover:!shadow-md !transition-all !duration-200",
  secondary:
    "!bg-[#1A1A1A] !text-white !border !border-[#1A1A1A] hover:!bg-[#111111] focus-visible:!ring-2 focus-visible:!ring-[#FFC107]/40 !font-semibold !shadow-sm !transition-all !duration-200",
  danger:
    "!bg-red-600 !border-red-700 !text-white hover:!bg-red-700 focus-visible:!ring-2 focus-visible:!ring-red-400/40 !font-semibold !shadow-sm !transition-all !duration-200",
  ghost:
    "!bg-[#F5F5F5] !text-[#111111] !border !border-[#E5E5E5] hover:!bg-[#ECECEC] !font-semibold !transition-all !duration-200",
};

export function toneClass(tone = "primary") {
  return coreToneClass[tone] ?? coreToneClass.primary;
}

export function fieldStateClass({ error, disabled }) {
  if (disabled) return "opacity-60";
  if (error) return "!border-red-500 !rounded-lg";
  return "";
}

/** PrimeReact inputs — border #E5E5E5, focus ring yellow */
export const coreInputBaseClass =
  "!border !border-[#E5E5E5] !rounded-lg !bg-white !shadow-sm !transition-all !duration-200 hover:!border-[#d1d1d1] focus:!border-[#FFC107] focus:!shadow-[0_0_0_3px_rgba(255,193,7,0.25)]";
