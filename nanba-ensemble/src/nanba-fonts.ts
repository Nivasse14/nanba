import { readFileSync } from "node:fs";
export const fonts = {
  latin: readFileSync(
    new URL("../assets/fonts/NotoSans-Regular.ttf", import.meta.url),
  ),
  tamil: readFileSync(
    new URL("../assets/fonts/NotoSansTamil-Regular.ttf", import.meta.url),
  ),
};
