import { defaultLang, supportedLanguages, ui, type SupportedLanguage } from './ui';

export type TranslationKey = keyof typeof ui[typeof defaultLang];

/**
 * Extract language code from current URL pathname
 */
export function getLangFromUrl(url: URL): SupportedLanguage {
  const [, firstSegment] = url.pathname.split('/');
  if (firstSegment && firstSegment in supportedLanguages) {
    return firstSegment as SupportedLanguage;
  }
  return defaultLang;
}

/**
 * Get translation function for a given language
 */
export function useTranslations(lang: SupportedLanguage) {
  return function t(key: TranslationKey): string {
    const dict = ui[lang] || ui[defaultLang];
    return (dict as Record<string, string>)[key] || (ui[defaultLang] as Record<string, string>)[key] || key;
  };
}

/**
 * Remove any leading locale prefix from a pathname
 */
export function stripLocaleFromPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0 && segments[0] in supportedLanguages) {
    segments.shift();
  }
  const clean = segments.join('/');
  return clean ? `/${clean}` : '/';
}

/**
 * Get localized URL path for a given language
 */
export function getLocalizedPath(pathname: string, targetLang: SupportedLanguage): string {
  const cleanPath = stripLocaleFromPath(pathname);
  if (targetLang === defaultLang) {
    return cleanPath;
  }
  return cleanPath === '/' ? `/${targetLang}/` : `/${targetLang}${cleanPath}`;
}

/**
 * Generate bidirectional hreflang link objects for SEO
 */
export function getHreflangLinks(pathname: string, siteUrl = 'https://makegif.github.io') {
  const cleanSiteUrl = siteUrl.replace(/\/+$/, '');
  const cleanPath = stripLocaleFromPath(pathname);

  const links = (Object.keys(supportedLanguages) as SupportedLanguage[]).map((lang) => {
    const path = lang === defaultLang
      ? (cleanPath === '/' ? '/' : cleanPath)
      : (cleanPath === '/' ? `/${lang}/` : `/${lang}${cleanPath}`);

    return {
      lang,
      url: `${cleanSiteUrl}${path}`,
    };
  });

  // Add x-default pointing to the default English URL
  const defaultPath = cleanPath === '/' ? '/' : cleanPath;
  links.push({
    lang: 'x-default' as unknown as SupportedLanguage,
    url: `${cleanSiteUrl}${defaultPath}`,
  });

  return links;
}
