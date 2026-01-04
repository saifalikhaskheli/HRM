import { ExternalLink } from 'lucide-react';

const APP_VERSION = '1.0.0';

interface AppFooterProps {
  showFooter?: boolean;
}

export function AppFooter({ showFooter = true }: AppFooterProps) {
  const currentYear = new Date().getFullYear();

  if (!showFooter) {
    return null;
  }

  return (
    <footer className="h-10 border-t border-border/40 bg-muted/20 px-4 flex items-center justify-between text-xs text-muted-foreground shrink-0">
      <div className="flex items-center gap-1">
        <span>© {currentYear} HR Suite</span>
      </div>

      <div className="hidden sm:block text-muted-foreground/60">
        Powered by HR Suite
      </div>

      <div className="flex items-center gap-4">
        <a
          href="/privacy"
          className="hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded"
        >
          Privacy
        </a>
        <a
          href="/terms"
          className="hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded"
        >
          Terms
        </a>
        <a
          href="mailto:support@hrsuite.com"
          className="hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded flex items-center gap-1"
        >
          Support
          <ExternalLink className="h-3 w-3" />
        </a>
        <span className="text-muted-foreground/50 hidden md:inline">v{APP_VERSION}</span>
      </div>
    </footer>
  );
}
