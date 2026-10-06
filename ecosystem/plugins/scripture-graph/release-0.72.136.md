AI scripture and vault citations now preview the cited page or verse inside the assistant instead of dismissing the conversation. Chat returns to the existing conversation with its draft and scroll position preserved; Read full screen remains a separate action.

The link handler runs before Obsidian's default rendered-link navigation, and newly fetched pages can resolve before the metadata cache updates. Failed fetches leave the assistant open with an error. External web links keep their normal browser behavior.

Validation: six AI navigation tests covering citation success, unavailable pages, metadata-cache delay, preserved conversation state, deliberate navigation, and external links; plugin typecheck/build; full server regression suite.
