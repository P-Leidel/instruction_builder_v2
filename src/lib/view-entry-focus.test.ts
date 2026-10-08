import { describe, expect, it } from "vitest";
import { createShellFocusAdapter, type FocusTarget } from "./view-entry-focus";

describe("shell focus adapter", () => {
  it("schedules entry and all return destinations behind currentness and modal guards", () => {
    const queued: (() => void)[] = [], events: string[] = []; let current = true, modal = false;
    const target = (name: string): FocusTarget => ({ isConnected: true, focus: () => { events.push(name); }, scrollIntoView: () => { events.push("scroll:" + name); } });
    let connected = true;
    const entry = target("entry"), opener = { ...target("opener"), get isConnected() { return connected; } }, picture = target("picture"), group = target("group"), first = target("first");
    let foundPicture: FocusTarget | null = picture, foundGroup: FocusTarget | null = group;
    const adapter = createShellFocusAdapter({ schedule: (run) => { queued.push(run); }, hasModal: () => modal, captureOpener: () => opener,
      entry: () => entry, picture: () => foundPicture, group: () => foundGroup, firstAdd: () => first });
    const run = () => { queued.splice(0).forEach((callback) => callback()); };
    const destination = { pictureId: "picture", groupId: "group", opener };
    adapter.enter("editor", () => current); expect(events).toEqual([]); run(); expect(events.splice(0)).toEqual(["entry"]);
    for (const request of [() => adapter.enter("reader", () => current), () => adapter.returnToEditor(destination, () => current), () => adapter.restore(opener, () => current)]) {
      request(); current = false; run(); expect(events).toEqual([]); current = true;
      request(); modal = true; run(); expect(events).toEqual([]); modal = false;
    }
    adapter.returnToEditor(destination, () => current); run(); expect(events.splice(0)).toEqual(["picture", "scroll:picture"]);
    foundPicture = null; adapter.returnToEditor(destination, () => current); run(); expect(events.splice(0)).toEqual(["group", "scroll:group"]);
    foundGroup = null; adapter.returnToEditor(destination, () => current); run(); expect(events.splice(0)).toEqual(["opener"]);
    adapter.restore(opener, () => current); run(); expect(events.splice(0)).toEqual(["opener"]);
    connected = false; adapter.returnToEditor(destination, () => current); run(); expect(events.splice(0)).toEqual(["first"]);
    adapter.restore(opener, () => current); run(); expect(events).toEqual([]);
    expect(adapter.captureOpener()).toBe(opener);
  });
});
