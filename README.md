# ChatGPT Conversation Approval Helper

Minimal Chrome MV3 extension for `https://chatgpt.com/*`.

> Unofficial helper. When enabled, it automatically approves conversation-level app consent prompts. Review the code and use it only if you understand that this skips a manual consent click.

## Behavior

- Uses a `MutationObserver`; no screenshot polling, coordinate clicking, CUA, Chrome debugger API, or network requests.
- Matches conversation-level consent only:
  - `Allow <APP> for this conversation`
  - On the Korean approval-card layout, structural detection is used only to locate the split-menu trigger; the final approval still requires the exact conversation-level menu item.
- No app allowlist: any app is eligible if the prompt is specifically conversation-level consent.
- Acts only when exactly one matching approval/menu target is present.
- Generic `Allow`, delete, submit, payment, permission-change, and other confirmations are ignored.
- Permissions are limited to `storage` and `https://chatgpt.com/*`.

## ON / OFF

Click the extension icon and use the **Conversation 승인 자동화** toggle.

- ON: conversation-level app consent is auto-approved.
- OFF: no approval clicks are performed.
- Default after first install: OFF.

The toggle is stored in `chrome.storage.local` and applies to all ChatGPT tabs.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select this repository folder.
6. Reload ChatGPT tabs that were already open before installation once.
7. Click the extension icon and switch it ON only when you want automatic conversation-level approval.

## Limitations

- This depends on ChatGPT's current DOM/accessibility labels and may stop working after UI changes.
- It does not modify MCP servers, tunnels, plugins, or backend configuration.
- The extension code contains no network requests.

## Rollback

Turn the popup toggle OFF, or disable/remove the extension in `chrome://extensions`.
