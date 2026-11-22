# User Guide: Nijghor ("Our Home")

Welcome to **Nijghor**, a zero-knowledge private messenger designed to combine WhatsApp's simplicity with Telegram's speed and security.

---

## 1. Core Principles

- **No Phone Numbers**: Your identity is purely your `@username`.
- **Browser-Only Chat Storage**: Your chats, voice notes, and media exist **only in your browser's encrypted storage**. Nothing is saved in the cloud.
- **Fast WebSocket Relay**: The server is a fast relay that immediately purges messages once delivered to the recipient.
- **House-Tick Receipts**:
  - 🕒 **Clock**: Saved in your local browser outbox.
  - 🏠 **Outline House**: Delivered to the server relay.
  - 🏡 **Filled House**: Reached the recipient's device.
  - ✨ **Glowing House**: Read by the recipient.

---

## 2. Onboarding in 30 Seconds

1. **Enter Email**: Receive a 6-digit verification code. (Email is used purely for verification and recovery; it is never shared with anyone).
2. **Choose @username**: Pick a unique username (e.g. `@rahul`).
3. **Choose Sign-in Method**:
   - **Passkey (Recommended)**: Fingerprint, Face ID, or Windows Hello.
   - **Password**: Client-hashed password.
4. **Download Recovery Key**: Download your `.nijghor` recovery key file and keep it in a safe place.

---

## 3. Keyboard Shortcuts

Press `?` anywhere to open the shortcuts cheat sheet:
- `Ctrl / Cmd + K`: Quick Room Switcher
- `Ctrl / Cmd + F`: Search messages in active room
- `Alt + Up / Down`: Navigate rooms
- `Enter`: Send message
- `Shift + Enter`: New line
- `Esc`: Close open modal / cancel reply

---

## 4. Features & How to Use Them

### Voice Notes
- Click and hold the microphone icon in the compose bar.
- Release to send; click **Cancel** to discard.
- Playback speeds can be toggled between `1x`, `1.5x`, and `2x`.

### Disappearing Messages
- When creating a room or in Room settings, choose an expiration timer (`30s`, `5m`, `1h`, `24h`, `7d`).
- Messages are automatically deleted from your local storage once expired.

### Safety Numbers
- Open Room Info and click **Verify Safety Number**.
- Compare the 60-digit fingerprint with your friend or scan the code in person.
- Click **Mark as Verified** once confirmed.

### Encrypted Backups (.nijghor)
- Because chat history is stored only in this browser, switching to a new device or browser requires importing your backup.
- Click **Export Backup**, set a passphrase, and save your `.nijghor` file.
- On your new device, click **Import Backup**, choose the file, and enter your passphrase.
