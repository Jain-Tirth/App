import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { Button } from './ui/button';
import { ShortlistDrawer } from './ShortlistDrawer';

interface ShortlistButtonProps {
  token: string;
  profileRef: string;
  onLogout: () => void;
  size?: 'default' | 'sm';
}

/** Opens the shortlist drawer for one profile. Focus returns here when it closes. */
export function ShortlistButton({ token, profileRef, onLogout, size = 'sm' }: ShortlistButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size={size}
        variant="outline"
        data-testid="shortlist-button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="max-w-full gap-1.5 whitespace-normal"
      >
        <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
        Shortlist
      </Button>
      {open ? (
        <ShortlistDrawer
          token={token}
          profileRef={profileRef}
          onLogout={onLogout}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
