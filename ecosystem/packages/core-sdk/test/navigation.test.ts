import { describe, expect, it } from "vitest";
import { navigationRequest } from "../src/ai/navigation";

describe("local Ask navigation", () => {
  it.each(["Take me to alma36:5", "open Alma 36:5", "Please go to ALMA 36 : 5."])("handles %s", question => {
    expect(navigationRequest(question)).toEqual({ page: "Alma 36", verse: "alma-36-5" });
  });
  it("supports numbered books and whole chapters", () => {
    expect(navigationRequest("show me 1nephi3:7")).toEqual({ page: "1 Nephi 3", verse: "1ne-3-7" });
    expect(navigationRequest("open Alma 36")).toEqual({ page: "Alma 36" });
  });
  it.each(["Explain Alma 36:5", "open Alma 36:5 and explain it", "Don't take me to Alma 36:5", "open Alma 999:5", "open Alma 36:0", "open unknown36:5"])("leaves non-navigation or invalid requests alone: %s", question => {
    expect(navigationRequest(question)).toBeNull();
  });
});
