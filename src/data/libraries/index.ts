import { KITCHEN_LIBRARY } from "./kitchen";
import { ROUTINES_LIBRARY } from "./routines";
import { LEARNING_LIBRARY } from "./learning";
import type { ContentLibrary } from "../../model/library";

export const CONTENT_LIBRARIES: readonly ContentLibrary[] = Object.freeze([
  KITCHEN_LIBRARY, ROUTINES_LIBRARY, LEARNING_LIBRARY,
]);
