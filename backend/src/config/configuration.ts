function emptyToUndefined(value: string | undefined): string | undefined {
  if (value === undefined || value === '') return undefined;
  return value;
}

function optionalInt(value: string | undefined): number | undefined {
  const cleaned = emptyToUndefined(value);
  if (cleaned === undefined) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

const configuration = () => ({
  appName: process.env.APP_NAME ?? 'keitaro-wrapper',
  debug: (process.env.DEBUG ?? 'false').toLowerCase() === 'true',
  port: Number(process.env.PORT ?? 3000),
  mongodbUri:
    process.env.MONGODB_URI ?? 'mongodb://localhost:27017/keitaro',
  keitaro: {
    url: (process.env.KEITARO_URL ?? '').replace(/\/$/, ''),
    apiKey: process.env.KEITARO_API_KEY ?? '',
    domainId: optionalInt(process.env.KEITARO_DOMAIN_ID),
    groupId: optionalInt(process.env.KEITARO_GROUP_ID),
    sourceId: optionalInt(process.env.KEITARO_SOURCE_ID),
    domainName: process.env.KEITARO_DOMAIN_NAME ?? '',
    groupName: process.env.KEITARO_GROUP_NAME ?? 'FORTESTS',
    sourceName: process.env.KEITARO_SOURCE_NAME ?? 'FORTESTS',
    whitePageUrl: process.env.KEITARO_WHITE_PAGE_URL ?? 'https://google.com',
  },
});

export default configuration;

export type AppConfig = ReturnType<typeof configuration>;
export type KeitaroConfig = AppConfig['keitaro'];
