const { fetchWithAuth } = require("./index");
const { logIfDebug } = require("./index");
const config = require(`./config.json`);
const { mapToBody } = require("./index");
const { piHoleSummaryData } = require("./index.mockdata");
const { piHoleTopItemsData } = require("./index.mockdata");
const { piHoleRecentBlockedData } = require("./index.mockdata");
const { mapKeyValuePairToString } = require("./index");

test("Tests fetching Json Placeholder via fetchWithAuth", () => {
  return fetchWithAuth("https://jsonplaceholder.typicode.com/todos/1").then(
    (data) => {
      expect(data.title).toBe("delectus aut autem");
    }
  );
});

test("Tests debug logging: flag is not set -> should not log", () => {
  config.debugMode = false;
  const spy = jest.spyOn(console, "log").mockImplementation();
  logIfDebug("test msg");
  expect(console.log).toHaveBeenCalledTimes(0);
  spy.mockRestore();
});

test("Tests debug logging: flag is set -> should log", () => {
  config.debugMode = true;
  const spy = jest.spyOn(console, "log").mockImplementation();
  logIfDebug("test msg");
  expect(console.log).toHaveBeenCalledTimes(1);
  spy.mockRestore();
});

test("Tests mapping of pi hole data -> mapped data", () => {
  let body = mapToBody(
    piHoleSummaryData,
    piHoleTopItemsData,
    piHoleRecentBlockedData
  );
  expect(body.blockListSize).toBe(piHoleSummaryData.domains_being_blocked);
  expect(body.dnsQueriesToday).toBe(piHoleSummaryData.dns_queries_today);
  expect(body.adsBlockedToday).toBe(piHoleSummaryData.ads_blocked_today);
  expect(body.totalClientsSeen).toBe(piHoleSummaryData.clients_ever_seen);
  expect(body.totalDNSQueries).toBe(piHoleSummaryData.dns_queries_all_types);
  expect(body.topQuery).toBe("data.iot.us-east-1.amazonaws.com (3741 Queries)");
  expect(body.topBlockedQuery).toBe(
    "web.vortex.data.microsoft.com (928 Queries)"
  );
  expect(body.lastBlockedQuery).toBe(piHoleRecentBlockedData);
});

test("Tests mapping of key value pair -> mapped data", () => {
  expect(mapKeyValuePairToString(piHoleTopItemsData.top_queries, 0)).toBe(
    "data.iot.us-east-1.amazonaws.com (3741 Queries)"
  );
  expect(mapKeyValuePairToString(piHoleTopItemsData.top_queries, 1)).toBe(
    "lametric.iderp.io (2854 Queries)"
  );
  expect(mapKeyValuePairToString(piHoleTopItemsData.top_ads, 0)).toBe(
    "web.vortex.data.microsoft.com (928 Queries)"
  );
  expect(mapKeyValuePairToString(piHoleTopItemsData.top_ads, 1)).toBe(
    "ichnaea.netflix.com (647 Queries)"
  );
});
