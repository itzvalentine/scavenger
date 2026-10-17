# ◆ Scavenger

Look at old tech. AI finds what's worth saving, designs it a new body, and sends it to your 3D printer.

This is a **concept prototype** built for the Meta Quest 3S: a WebXR page that runs in the Quest Browser with passthrough, so the Scavenger interface floats around a real object in your room.

## Demo flow

1. **Ready**: look at an old device. A ring shows where the surface is.
2. **Scan**: pinch, and scan brackets and a sweep pass over the object.
3. **Analysis**: part labels pop up (✓ worth saving, ✕ broken).
4. **AI design**: pinch, and a hologram of the new build assembles next to it.
5. **Fabricate**: pinch, and it "prints" layer by layer, then flashes firmware.
6. **Reborn**: the finished build. Pinch to start again.

On a computer or phone, the same demo plays in 3D with a stand-in radio. Use the button or the space bar to step through.

## Open it on the Quest 3S

1. Put the page online with GitHub Pages: repo **Settings → Pages → Deploy from a branch**, pick the branch, folder `/ (root)`, then **Save**.
2. On the Quest, open the **Browser** and go to the Pages link.
3. Tap **START AR** and allow access.
4. Look at your object, then **pinch** (or pull the trigger) to move through the steps.
5. To record: **Meta button → Camera → Record video**.

## Customize it for your object (no code needed)

Add these to the end of the link:

| Setting | Example |
|---|---|
| `device` | `?device=Game%20Boy` |
| `era` | `&era=1989` |
| `condition` | `&condition=Cracked%20screen` |
| `parts` (start with `!` for broken) | `&parts=Screen,Buttons,Speaker,!Battery%20Door` |
| `build` | `&build=Pocket%20Retro%20Console` |
| `brain` | `&brain=Raspberry%20Pi%20Zero` |
| `time` | `&time=2h%2040m` |
| `size` (object size in meters) | `&size=0.15` |
| `auto` (plays hands-free) | `&auto` |

`%20` means a space.
