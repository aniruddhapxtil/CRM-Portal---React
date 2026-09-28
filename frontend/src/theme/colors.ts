/**
 * Theme color palette for UI components.
 * Centralized color configuration for consistent branding.
 * Optimized for light theme with white text on colored backgrounds.
 *
 * Canonical source of truth — Tailwind tokens in src/index.css are derived from this.
 */

const themeColors = {
  surface: {
    warm: "#F8F7F4", // Main app background — warm off-white
    sidebar: "#F0EEE9", // Sidebar background — warm stone
    sidebarHover: "#E8E5DE", // Sidebar item hover state
    sidebarActive: "#DDD9CF", // Sidebar item active/selected state
    card: "#FAFAF8", // Card and panel backgrounds
    overlay: "#ECEAE4", // Slide-over panel and modal backgrounds
  },

  // Primary color palette: Deep teal to soft mint
  blue: {
    darkest: "#0a5647", // Deep teal for text
    dark: "#10b981", // Emerald for accents
    main: "#14b8a6", // Soft teal for primary actions
    light: "#5eead4", // Light teal for hovers
    lightest: "#99f6e4", // Very soft mint
  },

  loading: {
    skeleton: {
      base: "#e8f5f1",
      shimmer: "#d0f0e5",
      pulse: "#c0ebe0",
    },
    spinner: "#03e4da",
  },

  preview: {
    bg: "#ffffff",
    border: "#06E1B0",
    shadow: "0 4px 12px rgba(6, 225, 176, 0.15)",
    text: "#0a7d3e",
    titleColor: "#03e4da",
  },

  keyboard: {
    bg: "#f0fdf7",
    border: "#06E1B0",
    text: "#0a7d3e",
    shadow: "0 2px 4px rgba(0,0,0,0.1)",
  },

  glass: {
    background: "rgba(255, 255, 255, 0.7)",
    backgroundDark: "rgba(31, 41, 55, 0.7)",
    blur: "blur(12px)",
    border: "rgba(6, 225, 176, 0.2)",
    shadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
  },

  background: {
    sidebar: "linear-gradient(180deg, #e8f9f1 0%, #f0fdf7 100%)",
    sidebarHover: "#e0f8ed",
    main: "linear-gradient(to bottom, #f9fdfb, #ffffff)",
    mainAlt: "linear-gradient(135deg, #f9fdfb 0%, #ffffff 50%, #f9fdfb 100%)",
    userBubble: "linear-gradient(135deg, #e8f9f1, #f0fdf9)",
    botBubble: "#ffffff",
    tabContent: "linear-gradient(to bottom, #ffffff, #fafdfb)",
    chatItemSelected: "#d1f4e3",
    chatItemHover: "#e8f9f1",
    accentLight: "#e8f9f1",
    accentLighter: "#f0fdf7",
  },

  charts: {
    palette: ["#10b981", "#06E1B0", "#34d399", "#0a7d3e", "#6ee7b7"],
    paletteExtended: [
      "#10b981",
      "#06E1B0",
      "#34d399",
      "#0a7d3e",
      "#6ee7b7",
      "#059669",
      "#03e4da",
      "#14b8a6",
      "#a7f3d0",
      "#047857",
    ],
    textColors: {
      "#10b981": "#ffffff",
      "#06E1B0": "#0a7d3e",
      "#34d399": "#0a7d3e",
      "#0a7d3e": "#ffffff",
      "#6ee7b7": "#0a7d3e",
      "#059669": "#ffffff",
      "#03e4da": "#0a7d3e",
      "#14b8a6": "#ffffff",
      "#a7f3d0": "#0a7d3e",
      "#047857": "#ffffff",
    } as Record<string, string>,
    gradients: {
      primary: "linear-gradient(135deg, #10b981 0%, #06E1B0 100%)",
      secondary: "linear-gradient(135deg, #34d399 0%, #6ee7b7 100%)",
      dark: "linear-gradient(135deg, #0a7d3e 0%, #059669 100%)",
    },
  },

  focus: {
    overlayBg: "rgba(0, 0, 0, 0.05)",
    activeBorder: "#03e4da",
    dimOpacity: 0.4,
  },

  breadcrumb: {
    bg: "#f0fdf795",
    border: "#06E1B0",
    text: "#0a7d3e",
    accentText: "#03e4da",
  },

  tab: {
    activeBg: "#03e4da",
    activeText: "#FFFFFF",
    activeBorder: "#0cda4f",
    inactiveBg: "#ECF5F2",
    inactiveText: "#0DD82F",
    inactiveBorder: "#08DE87",
    hoverBg: "#06E1B0",
    hoverText: "#FFFFFF",
  },

  collapsible: {
    headerBg: "#06E1B0",
    headerText: "#FFFFFF",
    headerBorder: "#03e4da",
    expandedBorder: "#3fee88",
  },

  chart: {
    series: [
      "#07210b",
      "#0cda4f",
      "#03e4da",
      "#06E1B0",
      "#3fee88",
      "#0DD82F",
      "#08DE87",
      "#03E4E0",
      "#007fcd",
    ],
    primary: "#03e4da",
    secondary: "#06E1B0",
    accent: "#3fee88",
  },

  typography: {
    primary: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "'IBM Plex Mono', 'SF Mono', monospace",
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    tight: "-0.02em", // Headers
    trackingNormal: "0", // Body text letter-spacing (source object used a duplicate "normal" key for this — renamed to avoid clobbering the 400 font-weight value)
    wide: "0.02em", // All caps labels
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.7,
    },
  },

  extras: {
    greenAlt: "#0DD82F",
    tealAlt: "#08DE87",
    cyanAlt: "#03E4E0",
    blueAccent: "#007fcd",
    gray: "#7A7A7A",
    darkBg: "#200c3f",
    black: "#000000",
    lightBg: "#ECF5F2",
    white: "#ffffff",
  },
};

export default themeColors;
