export function isAppInstalled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // 1. Check if running inside PWA standalone mode (Android or iOS full screen)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");
    if (isStandalone) return true;

    // 2. Check if user already installed, added to home screen, or downloaded APK
    return (
      localStorage.getItem("data1gh_app_installed") === "true" ||
      localStorage.getItem("data1gh_app_downloaded") === "true"
    );
  } catch {
    return false;
  }
}

export function markAppInstalled(type: "installed" | "downloaded" | "ios_added" = "installed") {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("data1gh_app_installed", "true");
    if (type === "downloaded") {
      localStorage.setItem("data1gh_app_downloaded", "true");
    }
    window.dispatchEvent(new Event("data1gh-app-installed"));
  } catch {}
}
