/**
 * Applies the stored theme before paint so the first frame is not a flash of
 * the wrong palette. Kept inline and tiny on purpose.
 */
export function ThemeScript() {
  const script = `(function(){try{var raw=localStorage.getItem('scantrade.settings.v1');var pref=raw?JSON.parse(raw).theme:'light';if(pref==='auto'){pref=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=pref||'light';}catch(e){document.documentElement.dataset.theme='light';}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
