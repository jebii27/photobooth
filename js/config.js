export const LAYOUT_PRESETS = {
  single: {
    key: "single",
    label: "Single Portrait",
    width: 1400,
    height: 1900,
    slots: [
      { x: 120, y: 100, width: 1160, height: 1720 }
    ]
  },
  grid2x2: {
    key: "grid2x2",
    label: "2x2 Grid",
    width: 1800,
    height: 2020,
    slots: [
      { x: 100, y: 100, width: 770, height: 890 },
      { x: 930, y: 100, width: 770, height: 890 },
      { x: 100, y: 1050, width: 770, height: 890 },
      { x: 930, y: 1050, width: 770, height: 890 }
    ]
  },
  strip4: {
    key: "strip4",
    label: "Classic 4-Shot Strip",
    width: 1200,
    height: 3260,
    slots: [
      { x: 90, y: 90, width: 1020, height: 740 },
      { x: 90, y: 870, width: 1020, height: 740 },
      { x: 90, y: 1650, width: 1020, height: 740 },
      { x: 90, y: 2430, width: 1020, height: 740 }
    ]
  },
  strip4Horizontal: {
    key: "strip4Horizontal",
    label: "Horizontal 4-Shot Strip",
    width: 3600,
    height: 1200,
    slots: [
      { x: 90, y: 90, width: 780, height: 1020 },
      { x: 960, y: 90, width: 780, height: 1020 },
      { x: 1830, y: 90, width: 780, height: 1020 },
      { x: 2700, y: 90, width: 780, height: 1020 }
    ]
  }
};

export const STICKER_ASSETS = {
  none: "",
  spark: "images/sticker-spark.svg",
  star: "images/sticker-star.svg",
  camera: "images/sticker-camera.svg"
};

export const FRAME_OPTIONS = ["neon", "film", "studio", "none"];
