// Run with `npm test` (builds first, then `node --test`).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  generateId,
  toAppDeviceId,
  exportPreviewsForApp,
  mapSimulatorToDeviceId,
} from "../dist/helpers.js";

test("generateId is unique and prefixed", () => {
  const a = generateId();
  const b = generateId();
  assert.match(a, /^preview_\d+_[a-z0-9]{1,9}$/);
  assert.notEqual(a, b);
});

test("toAppDeviceId maps underscore ids to app dot ids", () => {
  assert.equal(toAppDeviceId("iphone_6_7"), "iphone_6.7");
  assert.equal(toAppDeviceId("iphone_air"), "iphone_air_6.5");
  assert.equal(toAppDeviceId("ipad_8_3"), "ipad_10.9");
});

test("toAppDeviceId passes unknown and empty ids through", () => {
  assert.equal(toAppDeviceId("iphone_6.7"), "iphone_6.7");
  assert.equal(toAppDeviceId("mac_16"), "mac_16");
  assert.equal(toAppDeviceId(undefined), undefined);
});

test("exportPreviewsForApp rewrites deviceId without mutating input", () => {
  const input = [
    { id: "1", screenshotPath: "/a.png", title: "t", subtitle: "s", deviceId: "iphone_6_9", createdAt: "x" },
    { id: "2", screenshotPath: "/b.png", title: "t", subtitle: "s", createdAt: "y" },
  ];
  const out = exportPreviewsForApp(input);
  assert.equal(out[0].deviceId, "iphone_6.9");
  assert.equal(out[1].deviceId, undefined);
  assert.equal(input[0].deviceId, "iphone_6_9");
});

test("mapSimulatorToDeviceId picks the most specific match", () => {
  assert.equal(mapSimulatorToDeviceId("iPhone 17 Pro Max"), "iphone_6_9");
  assert.equal(mapSimulatorToDeviceId("iPhone 17 Pro"), "iphone_6_3");
  assert.equal(mapSimulatorToDeviceId("iPhone Air"), "iphone_air");
  assert.equal(mapSimulatorToDeviceId("iPhone 16 Plus"), "iphone_6_7");
  assert.equal(mapSimulatorToDeviceId("iPhone 15"), "iphone_6_1");
  assert.equal(mapSimulatorToDeviceId("iPhone SE (3rd generation)"), "iphone_5_5");
  assert.equal(mapSimulatorToDeviceId("iPad Pro (12.9-inch) (6th generation)"), "ipad_12_9");
  assert.equal(mapSimulatorToDeviceId("iPad mini (A17 Pro)"), "ipad_8_3");
  assert.equal(mapSimulatorToDeviceId("Apple Watch Series 10"), "iphone_6_7");
});
