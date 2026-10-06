# Library cover artwork

These small UI images ship inside `main.js`. They are independent of vault
sync, offline shelf downloads, and reading-cache pruning. Missing or unreadable
local covers fall back to this catalog. Subfolders inherit an ancestor's cover
even when the device has no local images.

After adding or changing authored images in `AI Library/00 System/covers`, run
`node scripts/bundle-library-covers.mjs --refresh` from the plugin directory.
Review the copied images and credits. Every normal build regenerates `covers.ts`
from this checked-in directory; a personal vault is not required for a build.

See `CREDITS.md` for source attribution. Background scenes use their separate
on-demand cache and embedded starter scene.
