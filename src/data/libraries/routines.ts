import type { ContentLibrary } from "../../model/library";
import { catalogEntries } from "../catalog-entries";

export const ROUTINES_LIBRARY: ContentLibrary = Object.freeze({
  id: "routines",
  names: Object.freeze({"en":"Daily routines / workplace","de":"Alltag / Arbeitsplatz"}),
  entries: catalogEntries(["routines.action.wash-hands","routines.action.brush-teeth","routines.action.dress","routines.action.eat","routines.action.drink","routines.action.use-toilet","routines.action.rest","routines.action.clean-surface","routines.action.put-away","routines.action.collect","routines.action.carry","routines.action.bin-waste","routines.object.soap","routines.object.towel","routines.object.toothbrush","routines.object.clothes","routines.object.cup","routines.object.plate","routines.object.chair","routines.object.bed","routines.tool.cleaning-cloth","routines.tool.gloves","routines.object.bin","routines.object.toilet","shared.action.yes","shared.action.no","shared.action.more","shared.action.finished","shared.action.help","shared.action.stop","action.open","action.close","action.wait","action.repeat","action.check","object.water","tool.container","warning.hot","warning.sharp"]),
  provenanceIds: Object.freeze(["original-pictograms-2026-10-06"]),
});
