import { createContext, useContext, type ReactNode } from 'react';

const ScreenBannerContext = createContext<ReactNode>(null);

export function ScreenBannerProvider({
  banner,
  children,
}: {
  banner: ReactNode;
  children: ReactNode;
}) {
  return <ScreenBannerContext.Provider value={banner}>{children}</ScreenBannerContext.Provider>;
}

export function useScreenBanner(): ReactNode {
  return useContext(ScreenBannerContext);
}
