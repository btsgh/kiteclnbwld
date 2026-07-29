import { DM_Serif_Display, Inter } from 'next/font/google';

// Brand fonts wired in by nextjs-generation/scripts/plan_files.py.
// The planner LLM picks one Google Font per typography role from the
// Available Fonts map; this file exports each role as a next/font
// instance for components to apply via `.className`.

const _dmSerifDisplay = DM_Serif_Display({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
});
const _inter = Inter({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export const heroFont = _dmSerifDisplay;
export const headingFont = _dmSerifDisplay;
export const subHeadingFont = _inter;
export const bodyFont = _inter;
