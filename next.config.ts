import type { NextConfig } from 'next';
const ffmpeg = ['./node_modules/ffmpeg-static/ffmpeg'];
const config: NextConfig = { outputFileTracingIncludes: { '/api/analyze': ffmpeg, '/api/yandex/scan': ffmpeg, '/api/cron/yandex': ffmpeg } };
export default config;
