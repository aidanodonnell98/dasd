# Sketch & Stick Figure Playground

A single-page browser toy where you can draw items and watch a stick figure interact with them. Draw swords, platforms, props, and bounce pads directly on the canvas; guide the stick figure with arrow keys and space, and he will pick up nearby swords to swing them around.

## Running locally
Just open `index.html` in your browser. If you prefer a local server, from the project folder run:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000.

## Controls
- **Left click / drag**: Draw the currently selected item type.
- **Arrow keys**: Walk left/right (Up also jumps).
- **Space**: Jump.
- **R**: Clear all doodles and reset the stick figure.

## Item types
- **Sword**: The stick figure will grab nearby swords, play with them for a moment, and drop them.
- **Platform**: Acts as a ledge he can stand on.
- **Prop**: A visual obstacle with light physics.
- **Bounce pad**: Launches the stick figure upward.
