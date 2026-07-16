I have a CrowPanel ESP32-S3 4.2" e-ink display (400x300, SSD1683 controller)
set up with the Arduino IDE. My working configuration:

BOARD SETTINGS
- Board: ESP32S3 Dev Module
- Partition Scheme: Huge APP (3MB No OTA/1MB SPIFFS)
- PSRAM: OPI PSRAM
- Upload Speed: 115200 (921600 fails on this board's CH340)

LIBRARY
GxEPD2 (+ Adafruit GFX). The panel isn't officially supported, but this
driver class works:

  GxEPD2_BW<GxEPD2_420_GYE042A87, GxEPD2_420_GYE042A87::HEIGHT>
    display(GxEPD2_420_GYE042A87(CS, DC, RES, BUSY));

PINS
  #define PWR  7   // MUST be driven HIGH in setup() or the screen stays blank
  #define BUSY 48
  #define RES  47
  #define DC   46
  #define CS   45

BUTTONS (active LOW, INPUT_PULLUP)
  MENU 2 | EXIT 1 | ROCKER UP 6 | ROCKER PRESS 5 | ROCKER DOWN 4

CONSTRAINTS
- Panel safety matters: no timed/rapid refreshes. Prefer partial refreshes,
  with a periodic full refresh to clear ghosting. Call hibernate() after
  each draw. Debounce buttons and guard against refresh spam.
- 1-bit black/white only — no greyscale.
- [WiFi available, credentials go at the top] OR [must run fully offline]

Can you give me a complete .ino sketch that [DESCRIBE WHAT YOU WANT]?

Design: [minimalist pixel art / retro-future / etc.]