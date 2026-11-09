import { describe, expect, it } from "vitest";
import { roleType, stackName } from "./roles";

describe("roleType", () => {
  // Real titles from the directory, one or more per type.
  const cases: [string, ReturnType<typeof roleType>][] = [
    ["HR-compliance advisor", "advisor"],
    ["Employment-law researcher", "advisor"],
    ["Consumer-protection lawyer (fractional)", "advisor"],
    ["Messaging-compliance specialist", "advisor"],
    ["Payroll / HR partner manager", "growth"],
    ["Community-management network lead", "growth"],
    ["UK accountancy growth lead", "growth"],
    ["DevRel for Twilio agencies", "growth"],
    ["Instructional designer", "design"],
    ["Mobile + audio UX designer", "design"],
    ["Full-stack engineer (reminder engines)", "engineering"],
    ["VS Code extension developer", "engineering"],
    ["Container / runtime hackers", "engineering"],
    ["Clinic and trades operators as design partners", "design-partner"],
    ["Platform / SRE teams as design partners", "design-partner"],
    ["Small landlords (2–10 units) to pilot", "design-partner"],
    ["IT leads at 20–200 person companies", "design-partner"],
    ["Freelance grant writers", "design-partner"],
    ["Something new", "contributor"],
  ];
  it.each(cases)("%s → %s", (title, type) => expect(roleType(title)).toBe(type));
});

describe("stackName", () => {
  it("prettifies known names and keeps the rest", () => {
    expect(stackName("nextjs")).toBe("Next.js");
    expect(stackName("typescript")).toBe("TypeScript");
    expect(stackName("Elixir")).toBe("Elixir");
  });
});
