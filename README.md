# ChatGPT Conversation Approval Helper

Minimal Chrome MV3 extension for `https://chatgpt.com/*`.

> Unofficial helper. When enabled, it automatically approves conversation-level app consent prompts. Review the code and use it only if you understand that this skips a manual consent click.

## Behavior

- Uses a `MutationObserver`; no screenshot polling, coordinate clicking, CUA, Chrome debugger API, or network requests.
- Matches conversation-level consent only:
  - Exact English: `Allow <APP> for this conversation`.
  - Localized English/Korean conversation-scope variants containing `this conversation` / `this chat` or `이/현재 대화/채팅` together with an allow action.
  - Korean approval cards such as `ChatGPT가 <APP>을(를) 사용하도록 허용할까요?` are used only to locate the split-menu trigger; the final click still requires a conversation-scoped allow menu item.
- Explicit deny/disallow/cancel variants are rejected even if they mention the current conversation.
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
