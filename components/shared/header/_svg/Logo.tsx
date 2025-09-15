export default function Logo() {
  return (
    <svg
      fill="none"
      height="20"
      viewBox="0 0 120 20"
      width="120"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* V */}
      <path
        d="M10 2L15 18H13L10 8L7 18H5L10 2Z"
        fill="#262626"
      />
      {/* I */}
      <path
        d="M20 2H22V18H20V2Z"
        fill="#262626"
      />
      {/* B */}
      <path
        d="M27 2H33C35 2 36.5 3.5 36.5 5.5C36.5 7 35.5 8.5 34 9C35.5 9.5 37 11 37 13C37 15.5 35 18 32 18H27V2ZM29 8H32C33 8 34 7 34 5.5C34 4 33 4 32 4H29V8ZM29 16H32C34 16 35 15 35 13C35 11 34 10 32 10H29V16Z"
        fill="#262626"
      />
      {/* E */}
      <path
        d="M42 2H52V4H44V9H51V11H44V16H52V18H42V2Z"
        fill="#262626"
      />
      {/* Enterprise text */}
      <text
        x="60"
        y="13"
        fill="#666666"
        fontSize="11"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="400"
      >
        for Enterprises
      </text>
    </svg>
  );
}
