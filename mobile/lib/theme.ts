// MicroGRID Customer App Theme
// Brand: earth tones, Pixar meets Tesla — premium, warm, reliable

export const theme = {
  colors: {
    bg: '#FAFAF7',
    surface: '#FFFFFF',
    surfaceAlt: '#F5F3EE',
    surfaceHover: '#EDEAE3',
    border: '#E2DFD6',
    borderLight: '#F0EDE6',
    text: '#1A1A18',
    textSecondary: '#5C5A52',
    textMuted: '#8A877D',
    accent: '#1D7A5F',
    accentLight: '#E8F5EE',
    accentDark: '#145C47',
    accentText: '#FFFFFF',
    warm: '#C4922A',
    warmLight: '#FFF8E7',
    error: '#C53030',
    errorLight: '#FFF5F5',
    info: '#2563EB',
    infoLight: '#EFF6FF',
    stageComplete: '#1D7A5F',
    stageActive: '#2563EB',
    stageUpcoming: '#D1CFC8',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 999,
  },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
  },
} as const

export type Theme = typeof theme
