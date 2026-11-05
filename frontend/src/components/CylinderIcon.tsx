// A simple gas cylinder drawing used as the product image until real photos exist.
export function CylinderIcon({ sizeKg, className = '' }: { sizeKg: number; className?: string }) {
  const tall = sizeKg >= 13
  return (
    <svg viewBox="0 0 48 64" className={className} aria-hidden>
      <rect x="18" y="2" width="12" height="8" rx="2" fill="#646464" />
      <rect x="14" y="9" width="20" height="5" rx="2" fill="#a7a7a7" />
      <rect x={tall ? 6 : 9} y={tall ? 14 : 22} width={tall ? 36 : 30} height={tall ? 46 : 38} rx="12" fill="#e85002" />
      <rect x={tall ? 6 : 9} y={tall ? 30 : 34} width={tall ? 36 : 30} height="6" fill="#d9c3ab" />
      <text x="24" y={tall ? 54 : 54} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">
        {sizeKg}kg
      </text>
    </svg>
  )
}
