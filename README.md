# Scavenger

Tear down old tech in mixed reality, salvage the good parts, merge them into something new, sculpt a shell, and 3D print it.

This is a **concept prototype** for the Meta Quest 3S. It's a WebXR page that runs in the Quest Browser with passthrough, so the workshop floats in your real room. It also runs in any desktop or phone browser.

**Live:** https://itzvalentine.github.io/scavenger/

## Test case #001: BoomBot

Two devices, each with a problem the other one solves:

| Device | Specs | Problem |
|---|---|---|
| CV-C500 gesture stunt car | 2.4 GHz · 4WD · gesture watch · 3.7 V Li-ion (~500 mAh, typical for this class) | Battery dies in ~20–45 min. No speaker. |
| oraimo SpaceBox OBS-382 | 8 W · 45 mm driver + passive radiator · BT 5.4 · FM · 3.7 V 1800 mAh · 146×72×50 mm | Great sound, but it can't move. |

**The insight:** both run on a single 3.7 V Li-ion cell, so their parts can share power.

**The merge:** BoomBot, a roaming party speaker you steer by tilting your wrist. It uses the car's motors, gearboxes, wheels, receiver, lights and gesture watch, plus the speaker's driver, passive radiator, light ring, main board, USB-C board and 1800 mAh battery (3.6× the car's).

Specs come from retailer listings. Internal parts are modeled on typical teardowns of this class of device, so confirm them when you open yours.

## The seven steps

1. **Identify:** both devices are scanned and matched.
2. **Diagnose:** each device's weak spot is marked.
3. **Teardown:** an exploded view of every part. Grab any part, move it, turn it, and inspect it.
4. **Merge:** drag salvaged parts into the glowing slots of the BoomBot blueprint. Wrong parts get rejected (try the car battery).
5. **Source:** the few parts you'd still buy (switch, capacitor, connectors, wire, screws, filament), optional upgrades (ESP32, distance sensor, Raspberry Pi Zero 2 W), a cost breakdown, and a shopping list with links to Amazon, AliExpress, Jumia Nigeria and Alibaba.
6. **Sculpt:** shape the shell with pull, push and smooth brushes (mirrored), pick a base shape and color. Filament and print time update as you sculpt.
7. **Fabricate:** watch it print layer by layer, **export a real STL** of your sculpted shell, and take it for a test drive.

Prices in the Source step are estimates from typical 2026 listings. The store links open live search results, so you see current prices there. A web page can't check stores live by itself; that would need a server and store API access.

## Controls

| | Desktop | Meta Quest |
|---|---|---|
| Use a button | Click it | Point and pinch |
| Grab a part | Drag it | Point, pinch and hold |
| Turn a part | Right-drag | Turn your hand while holding |
| Inspect a part | Click | Quick pinch |
| Sculpt | Drag on the shell (Shift = opposite tool) | Point and pinch-hold on the shell |
| Change step | ← / → keys, or the panel | Panel buttons |

## Run it locally

Any static file server works, e.g. `npx http-server .` then open the printed address.

## Files

- `js/main.js`: app flow, interaction, XR, printing, STL export
- `js/sourcing.js`: parts to buy, prices and store links
- `js/devices.js`: the two devices and all their parts
- `js/kit.js`: geometry helpers (gears, boards, tires, motors, drivers…)
- `js/boombot.js`: the merged build and its slots
- `js/sculpt.js`: the sculptable shell
- `js/ui.js`: the floating panel and tags
- `js/sound.js`: UI sounds
