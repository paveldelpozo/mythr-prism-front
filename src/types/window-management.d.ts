interface ScreenDetailed extends Screen {
  readonly availLeft: number;
  readonly availTop: number;
  readonly left: number;
  readonly top: number;
  readonly isPrimary: boolean;
  readonly label: string;
}

interface ScreenDetails {
  readonly currentScreen: ScreenDetailed;
  readonly screens: ScreenDetailed[];
  addEventListener: (type: 'screenschange' | 'currentscreenchange', listener: EventListener) => void;
  removeEventListener: (type: 'screenschange' | 'currentscreenchange', listener: EventListener) => void;
}

interface Window {
  getScreenDetails?: () => Promise<ScreenDetails>;
}
