import { motion, useReducedMotion } from "framer-motion";
import { staggerItem } from "./presets";

export default function StaggerList({ items, renderItem, label }) {
  const reduce = useReducedMotion();
  return (
    <ul aria-label={label} className="flex list-none flex-col gap-3 p-0">
      {items.map((item, index) => (
        <motion.li key={item.id} {...staggerItem(Boolean(reduce), index)}>
          {renderItem(item, index)}
        </motion.li>
      ))}
    </ul>
  );
}
