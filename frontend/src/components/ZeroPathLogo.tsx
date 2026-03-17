/**
 * ZeroPath Z-mark SVG logo.
 * Accepts className for sizing; defaults to 21×24.
 */

interface ZeroPathLogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export default function ZeroPathLogo({ className, width = 21, height = 24 }: ZeroPathLogoProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 21 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="ZeroPath"
    >
      <path
        d="M15.7254 0C18.6203 0 20.9671 2.22314 20.9671 4.96552V9.93103H17.4726V6.62069C17.4726 6.2251 17.3994 5.84571 17.265 5.49404L6.38465 19.6803C6.56259 19.7097 6.74516 19.7264 6.93126 19.7292L6.98905 19.7297H13.9781C15.8888 19.7297 17.4413 18.2771 17.4722 16.4741L17.4726 16.4193V14.7641H20.9671V18.0745C20.9671 20.8169 18.6203 23.04 15.7254 23.04H5.24179C2.34683 23.04 0 20.8169 0 18.0745V13.109H3.49452V16.4193C3.49452 16.8149 3.56778 17.1943 3.70213 17.546L14.5825 3.35968C14.4046 3.33029 14.222 3.31365 14.0359 3.31079L13.9781 3.31034H6.98905C5.07838 3.31034 3.52585 4.76294 3.49499 6.56595L3.49452 6.62069V8.27586H0V4.96552C0 2.22314 2.34683 0 5.24179 0H15.7254Z"
        fill="#2577FF"
      />
    </svg>
  );
}
