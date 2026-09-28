<template>
  <!-- The Gemono logo: public/Gemono.ico rendered as an icon, transparent
       background. brightness(0) + invert(1) recolors the dark raster glyph
       to solid white so it matches the other (currentColor) sidebar icons —
       CSS can't recolor a raster any other way. scale-110 nudges it slightly
       larger than the box so it optically matches the stroke icons. -->
  <img
    src="/Gemono.ico"
    alt=""
    :width="size"
    :height="size"
    class="inline-block shrink-0 object-contain scale-110"
    :class="variant === 'white' ? 'brightness-0 invert' : 'brightness-0'"
  />
</template>
<script setup>
// variant 'white' (default): glyph forced to solid white — for dark sidebars/headers.
// variant 'dark': glyph solid black — for light canvases (white panels).
defineProps({
  size: { type: [String, Number], default: 24 },
  variant: { type: String, default: 'white' },
})
</script>