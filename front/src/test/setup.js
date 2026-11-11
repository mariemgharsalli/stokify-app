import { createElement } from "react";
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = () => ({
    matches: true,
    media: "",
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  });
}

vi.mock("framer-motion", () => {
  function Passthrough({ children }) {
    return children ?? null;
  }
  const balises = {};
  const motion = new Proxy(
    {},
    {
      get: (_cible, balise) => {
        const nom = typeof balise === "string" ? balise : "div";
        if (!balises[nom]) {
          balises[nom] = function Balise({ children }) {
            return createElement(nom, null, children);
          };
        }
        return balises[nom];
      },
    }
  );
  return {
    motion,
    AnimatePresence: Passthrough,
    useReducedMotion: () => true,
  };
});

vi.mock("react-leaflet", () => {
  function Passthrough({ children }) {
    return children ?? null;
  }
  return {
    MapContainer: Passthrough,
    TileLayer: () => null,
    Marker: () => null,
    Popup: () => null,
    Circle: () => null,
    useMap: () => ({}),
  };
});

vi.mock("recharts", () => {
  function Passthrough({ children }) {
    return children ?? null;
  }
  return {
    ResponsiveContainer: Passthrough,
    LineChart: Passthrough,
    BarChart: Passthrough,
    AreaChart: Passthrough,
    PieChart: Passthrough,
    Line: () => null,
    Bar: () => null,
    Area: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    CartesianGrid: () => null,
    Legend: () => null,
    Pie: () => null,
    Cell: () => null,
  };
});
