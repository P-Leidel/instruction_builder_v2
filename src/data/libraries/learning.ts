import type { ContentLibrary } from "../../model/library";
import { catalogEntries } from "../catalog-entries";

export const LEARNING_LIBRARY: ContentLibrary = Object.freeze({
  id: "learning",
  names: Object.freeze({"en":"Learning / classroom","de":"Lernen / Klassenzimmer"}),
  entries: catalogEntries(["learning.action.read","learning.action.write","learning.action.draw","learning.action.paint","learning.action.cut","learning.action.glue","learning.action.listen","learning.action.speak","learning.action.choose","learning.action.count","learning.action.play","learning.action.tidy","learning.object.book","learning.tool.pencil","learning.object.paper","learning.tool.scissors","learning.tool.glue","learning.tool.paintbrush","learning.object.blocks","learning.object.desk","learning.object.bag","learning.object.ball","learning.object.puzzle","learning.object.quiet-space","shared.action.yes","shared.action.no","shared.action.more","shared.action.finished","shared.action.help","shared.action.stop","action.open","action.close","action.wait","action.repeat","action.check","object.water","tool.container","warning.hot","warning.sharp","routines.action.eat","routines.action.drink","routines.action.rest","routines.action.put-away","routines.object.cup","routines.object.chair","routines.object.toilet"]),
  provenanceIds: Object.freeze(["original-pictograms-2026-10-06"]),
});
