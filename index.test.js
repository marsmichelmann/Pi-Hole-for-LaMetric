const { fetchWithAuth } = require("./index");
const { logIfDebug } = require("./index");
const config = require(`./config.json`);
const { mapToBody } = require("./index");
const { piHoleSummaryData } = require("./index.mockdata");
const { piHoleTopItemsData } = require("./index.mockdata");
const { piHoleRecentBlockedData } = require("./index.mockdata");
const { mapKeyValuePairToString } = require("./index");
const { piHoleErrorResponse } = require("./index.mockdata");
const { piHoleInvalidResponse } = require("./index.mockdata");
const { piHoleTest } = require("./index");
const {piHoleResponse} = require("./index.mockdata");
const { laMetricTest } = require("./index");

describe("testing pi hole for lametric", () => {
  it("should fetch Json Placeholder via fetchWithAuth", () => {
    return fetchWithAuth("https://jsonplaceholder.typicode.com/todos/1").then(
      (data) => {
        expect(data.title).toBe("delectus aut autem");
      }
    );
  });

  it("shouldn't log, when debug mode is disabled", () => {
    config.debugMode = false;
    const spy = jest.spyOn(console, "log").mockImplementation();
    logIfDebug("test msg");
    expect(spy).toHaveBeenCalledTimes(0);
    spy.mockRestore();
  });

  it("should log, if debug mode is enabled", () => {
    config.debugMode = true;
    const spy = jest.spyOn(console, "log").mockImplementation();
    logIfDebug("test msg");
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("should map pi hole data", () => {
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
    expect(body.topQuery).toBe(
      "data.iot.us-east-1.amazonaws.com (3741 Queries)"
    );
    expect(body.topBlockedQuery).toBe(
      "web.vortex.data.microsoft.com (928 Queries)"
    );
    expect(body.lastBlockedQuery).toBe(piHoleRecentBlockedData);
  });

  it("should map key value pair", () => {
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

  it("should exit program, when init of pi hole leads to error response", async () => {
    fetchMock.doMock();
    fetchMock.mockReject(piHoleErrorResponse);
    config.debugMode = true;
    const spyConsole = jest.spyOn(console, "log").mockImplementation();
    const spyProcessExit = jest
      .spyOn(process, "exit")
      .mockImplementation(() => {});
    const flushPromises = () => new Promise(setImmediate);

    piHoleTest();
    await flushPromises();

    expect(spyProcessExit).toBeCalled();
    expect(spyConsole).toBeCalledWith(piHoleErrorResponse);
    spyProcessExit.mockRestore();
    spyConsole.mockRestore();
    fetchMock.dontMock();
  });

  it("should exit program, when init of pi hole leads to unexpeced response", async () => {
    fetchMock.doMock();
    fetchMock.mockResponse(JSON.stringify(piHoleInvalidResponse));
    const spyProcessExit = jest
      .spyOn(process, "exit")
      .mockImplementation(() => {});
    const flushPromises = () => new Promise(setImmediate);

    piHoleTest();
    await flushPromises();

    expect(spyProcessExit).toBeCalled();
    spyProcessExit.mockRestore();
    fetchMock.dontMock();
  });

  it("should not exit program, when init of pi hole is successful", async () => {
    config.PiHole.IP = "127.0.0.1";
    config.PiHole.AuthKey = "4711";
    jest.useFakeTimers();

    fetchMock.doMock();
    // fetchMock.mockIf(/^http:\/\/127.0.0.1\/admin*$/, req => {
    //   return
    //     JSON.stringify(piHoleResponse);
    //
    //   //return JSON.stringify(piHoleResponse);
    // });

    fetchMock.mockResponse(JSON.stringify(piHoleResponse));

    const spyProcessExit = jest
        .spyOn(process, "exit")
        .mockImplementation(() => {});
    const flushPromises = () => new Promise(setImmediate);

    piHoleTest(() => {});
    await flushPromises();

    expect(spyProcessExit).not.toBeCalled();
    spyProcessExit.mockRestore();
    fetchMock.dontMock();
  });
});
