import type { Config } from 'tailwindcss';
import daisyui from 'daisyui';

// 셸·테마 구조는 games_card 통합어드민(admin-ui)을 참고했다: daisyUI 라이트/다크 2테마, 고밀도 표.
const config: Config = {
  content: ['./src/components/**/*.{ts,tsx}', './src/app/**/*.{ts,tsx}', './src/lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    logs: false,
    darkTheme: 'dark',
    themes: [
      {
        light: {
          primary: '#0E8A6A',
          'primary-content': '#ffffff',
          secondary: '#2563EB',
          'secondary-content': '#ffffff',
          accent: '#0EA5E9',
          'accent-content': '#ffffff',
          neutral: '#14232B',
          'neutral-content': '#E5ECEF',
          'base-100': '#ffffff',
          'base-200': '#F3F7F8',
          'base-300': '#DCE5E8',
          'base-content': '#16242B',
          info: '#2F80ED',
          success: '#16A34A',
          warning: '#D97706',
          error: '#DC2626',
          '--rounded-box': '0.75rem',
          '--rounded-btn': '0.5rem',
          '--rounded-badge': '0.375rem',
        },
      },
      {
        dark: {
          primary: '#2BB596',
          'primary-content': '#04231B',
          secondary: '#60A5FA',
          'secondary-content': '#0B1220',
          accent: '#38BDF8',
          'accent-content': '#0B1220',
          neutral: '#0B1418',
          'neutral-content': '#E5ECEF',
          'base-100': '#15212A',
          'base-200': '#0E171D',
          'base-300': '#26353F',
          'base-content': '#E4ECEF',
          info: '#60A5FA',
          success: '#34D399',
          warning: '#FBBF24',
          error: '#F87171',
          '--rounded-box': '0.75rem',
          '--rounded-btn': '0.5rem',
          '--rounded-badge': '0.375rem',
          'color-scheme': 'dark',
        },
      },
    ],
  },
};

export default config;
